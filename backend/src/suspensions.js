import mongoose from 'mongoose';
import { User, VerifiedUser } from './models.js';
// Conditional writes prevent expiry from undoing a later block, deletion or extension.
export async function expireSuspensions(now = new Date()) {
  const due = { status: 'suspended', suspensionUntil: { $lte: now } };
  if (!(await User.exists(due)) && !(await VerifiedUser.exists(due))) return;
  await mongoose.connection.transaction(async session => {
    const clear = { suspensionUntil: '', suspensionReason: '' };
    await User.updateMany(due, { $set: { status: 'active', active: true }, $unset: clear, $inc: { tokenVersion: 1 } }, { session });
    await VerifiedUser.updateMany(due, { $set: { status: 'active', active: true }, $unset: clear }, { session });
  });
}
