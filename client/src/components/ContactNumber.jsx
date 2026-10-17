import React from "react";
import { Phone, ArrowUpRight } from "lucide-react";
export function ContactNumber({ number, label = "Contact", compact = false }) {
  if (!number) return null;
  const href = "tel:" + number.replace(/[^+0-9]/g, "");
  return (
    <a
      className={compact ? "contact-number compact" : "contact-number"}
      href={href}
    >
      <span className="contact-icon">
        <Phone size={compact ? 14 : 20} />
      </span>
      <span>
        {!compact && <small>{label}</small>}
        <strong>{number}</strong>
      </span>
      {!compact && <ArrowUpRight size={17} />}
    </a>
  );
}
