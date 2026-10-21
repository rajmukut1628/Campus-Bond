import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
export function FeedBack() {
  const location=useLocation(), navigate=useNavigate();
  if(!location.state?.fromFeed)return null;
  return <button type="button" className="feed-return-button" onClick={()=>navigate(-1)}><ArrowLeft size={15}/>Back to Newsfeed</button>;
}
