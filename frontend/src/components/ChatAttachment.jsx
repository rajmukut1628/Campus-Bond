import React, { useState } from "react";
import { FileText, Download, ArrowUpRight } from "lucide-react";
import { Modal } from "./ui.jsx";
export function ChatAttachment({ attachment, onReady }) {
  const [preview, setPreview] = useState(false), [failed, setFailed] = useState(false);
  if (!attachment) return null;
  const url = `/api/v1/message-attachments/${attachment.id}`;
  const image = attachment.mimeType.startsWith("image/");
  return <div className="chat-attachment">
    {image && !failed && <button type="button" className="chat-attachment-thumbnail" aria-label={`View ${attachment.name}`} onClick={() => setPreview(true)}><img src={`${url}?preview=true`} alt={attachment.name} loading="lazy" onLoad={() => onReady?.()} onError={() => setFailed(true)}/></button>}
    <div className="chat-file-meta"><FileText size={17}/><span title={attachment.name}>{attachment.name}<small>{(attachment.size/1024).toFixed(0)} KB</small></span></div>
    <div className="chat-file-actions">{image && !failed ? <button type="button" onClick={() => setPreview(true)}>View</button> : <a href={url} target="_blank" rel="noreferrer">View</a>}<a href={`${url}?download=true`} download={attachment.name}><Download size={13}/>Download</a></div>
    {preview && <Modal title={attachment.name} onClose={() => setPreview(false)}><img className="chat-full-attachment" src={url} alt={attachment.name}/><a className="button" href={`${url}?download=true`} download={attachment.name}>Download image</a></Modal>}
  </div>;
}

export function ChatAttachments({ message, onReady }) {
  const files = message.attachments?.length ? message.attachments : message.attachment ? [message.attachment] : [];
  return <div className={`chat-attachments-grid ${files.length > 1 ? "multiple" : "single"}`}>{files.map(attachment=><ChatAttachment key={attachment.id} attachment={attachment} onReady={onReady}/>)}</div>;
}
