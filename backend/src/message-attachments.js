import { Router } from "express";
import { param } from "express-validator";
import multer from "multer";
import sharp from "sharp";
import mongoose from "mongoose";
import { DirectConversation, DirectMessage, Message, Mentorship, MessageAttachment, User } from "./models.js";
import { assert, roles, validate, acceptedRelationship, notify } from "./security.js";
import { mentorHasStarted } from "./mentorship-access.js";
import { directAccess } from "./direct-messaging.js";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 1, fieldSize: 20000 } });
async function connection(user, id, session, write = false) {
  const direct = await DirectConversation.findById(id).session(session || null);
  if (direct) {
    const access = await directAccess(user, direct, session, write);
    return { Model: DirectMessage, field: "conversation", kind: "direct", recipient: access.counterpart._id };
  }
  let relation;
  if (!write) {
    relation = await Mentorship.findOne({ _id: id, status: "completed", closedForConversion: true, $or: [{student:user._id},{mentor:user._id}] }).session(session || null);
    if (relation) {
      const people = await User.countDocuments({ _id: {$in:[relation.student,relation.mentor]}, active:true, role:{$in:["student","alumni"]} }).session(session || null);
      assert(people === 2,403,"This archived conversation is no longer accessible");
    }
  }
  if (!relation) relation = await acceptedRelationship(user, id, session, !write);
  if (write) {
    assert(String(relation.mentor) === String(user._id) || await mentorHasStarted(relation, session), 403, "Wait for your mentor's first message");
    const result = await Mentorship.updateOne({ _id: id, status: "accepted" }, { $inc: { accessVersion: 1 }, ...(String(relation.mentor) === String(user._id) && !relation.mentorStartedAt ? { $set: { mentorStartedAt: new Date() } } : {}) }, { session });
    assert(result.matchedCount === 1, 409, "Conversation permissions changed");
  }
  return { Model: Message, field: "mentorship", kind: "mentorship", recipient: String(relation.mentor) === String(user._id) ? relation.student : relation.mentor };
}
async function prepareFile(file) {
  const name = file.originalname.replace(/[\/\\\x00-\x1f\x7f]/g,"_").slice(-160);
  const data = file.buffer, extension = name.split(".").pop()?.toLowerCase();
  let mimeType, thumbnail;
  if (extension === "pdf") {
    assert(file.mimetype === "application/pdf" && data.subarray(0,5).toString() === "%PDF-" && data.subarray(Math.max(0,data.length-2048)).includes(Buffer.from("%%EOF")),422,"Choose a valid PDF file");
    mimeType = "application/pdf";
  } else {
    const formats = { jpg:"jpeg", jpeg:"jpeg", png:"png", webp:"webp" };
    assert(formats[extension],422,"Only JPG, PNG, WebP and PDF files are supported");
    try {
      const image = sharp(data,{limitInputPixels:25000000}), metadata = await image.metadata();
      assert(metadata.format === formats[extension],422,"Image content does not match its file type");
      thumbnail = await image.rotate().resize({width:640,height:640,fit:"inside",withoutEnlargement:true}).webp({quality:78}).toBuffer();
      mimeType = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
    } catch { assert(false,422,"Choose a valid JPG, PNG or WebP image"); }
  }
  return { name, data, mimeType, thumbnail, size:data.length };
}
export function messageAttachmentRoutes() {
  const r = Router();
  r.post("/conversations/:id/attachments", roles("student","alumni","admin","superadmin"),param("id").isMongoId(),validate,
    async(req,res,next)=>{ await connection(req.user,req.params.id,null);next(); },
    (req,res,next)=>upload.fields([{name:"files",maxCount:5},{name:"file",maxCount:1}])(req,res,error=>next(error?Object.assign(error,{status:error.code === "LIMIT_FILE_SIZE"?413:422}):undefined)),
    async(req,res)=>{
      const files = [...(req.files?.files || []),...(req.files?.file || [])];
      assert(files.length > 0 && files.length <= 5,422,"Choose up to 5 files");
      assert(files.reduce((total,file)=>total+file.size,0) <= 25*1024*1024,422,"Total attachment size must be at most 25 MB");
      const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
      assert(body.length <= 4000,422,"Message must be at most 4000 characters");
      const prepared=[];
      for (const file of files) prepared.push(await prepareFile(file));
      let message;
      await mongoose.connection.transaction(async session=>{
        const access=await connection(req.user,req.params.id,session,true), messageId=new mongoose.Types.ObjectId();
        const assets=prepared.map(file=>({_id:new mongoose.Types.ObjectId(),conversation:req.params.id,message:messageId,kind:access.kind,...file}));
        const attachments=assets.map(asset=>({id:asset._id,name:asset.name,mimeType:asset.mimeType,size:asset.size}));
        [message]=await access.Model.create([{_id:messageId,[access.field]:req.params.id,sender:req.user._id,body,attachments,attachment:attachments.length===1?attachments[0]:undefined}],{session});
        await MessageAttachment.create(assets,{session,ordered:true});
        await notify(access.recipient,`New ${attachments.length===1?"attachment":"attachments"} from ${req.user.name}`,`/app/messages/${req.params.id}`,session,{actor:req.user._id,category:"messages"});
      });
      res.status(201).json({item:message});
    });
  r.get("/message-attachments/:id",roles("student","alumni","admin","superadmin"),param("id").isMongoId(),validate,async(req,res)=>{
    const wantsPreview=req.query.preview === "true" && req.query.download !== "true";
    const asset=await MessageAttachment.findById(req.params.id).select(wantsPreview ? "+thumbnail" : "+data");
    assert(asset,404,"Attachment not found");
    const access=await connection(req.user,asset.conversation,null);
    const message=await access.Model.findOne({_id:asset.message,[access.field]:asset.conversation,deletedAt:{$exists:false},$or:[{"attachment.id":asset._id},{"attachments.id":asset._id}]});
    assert(message,404,"Attachment no longer available");
    const preview=wantsPreview && asset.thumbnail;
    // Old images and PDFs may have no thumbnail; fetch original bytes only when needed.
    if (!preview && !asset.data) {
      const original=await MessageAttachment.findById(asset._id).select("+data");
      assert(original?.data,404,"Attachment no longer available");
      asset.data=original.data;
    }
    const data=preview?asset.thumbnail:asset.data, mimeType=preview?"image/webp":asset.mimeType;
    const name=preview?"preview.webp":asset.name, filename=encodeURIComponent(name);
    const fallback=name.replace(/[^a-zA-Z0-9._ -]/g,"_");
    res.set({"Content-Type":mimeType,"Content-Length":String(data.length),"Content-Disposition":`${req.query.download==="true"?"attachment":"inline"}; filename="${fallback}"; filename*=UTF-8''${filename}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"});
    res.send(data);
  });
  return r;
}

