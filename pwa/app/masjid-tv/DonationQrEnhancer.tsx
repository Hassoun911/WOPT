"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";

function normalizeUrl(raw:string){
  const value=(raw||"").trim();
  if(!value||/Add donation|Add website|website link in setup|Add link in Studio/i.test(value))return "";
  if(/^https?:\/\//i.test(value))return value;
  return `https://${value.replace(/^\/+/,"")}`;
}

function qrUrl(value:string,size=260){
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(value)}`;
}

function settingsTarget(){
  try{
    const s=JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,unknown>;
    const donation=typeof s.donationUrl==="string"?s.donationUrl:"";
    const support=typeof s.supportUrl==="string"?s.supportUrl:"";
    const website=typeof s.websiteUrl==="string"?s.websiteUrl:"";
    const mosqueWebsite=typeof s.mosqueWebsite==="string"?s.mosqueWebsite:"";
    const mainWebsite=typeof s.mainWebsite==="string"?s.mainWebsite:"";
    return normalizeUrl(donation||support||website||mosqueWebsite||mainWebsite);
  }catch{return ""}
}

function inputValue(labelStart:string){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const label=labels.find(x=>(x.textContent||"").trim().toLowerCase().startsWith(labelStart.toLowerCase()));
  return (label?.querySelector<HTMLInputElement>("input,textarea")?.value||"").trim();
}

function targetFromEditor(){
  const donation=normalizeUrl(inputValue("Donation / support link"));
  const combined=normalizeUrl(inputValue("Website / donation link"));
  const main=normalizeUrl(inputValue("Main website"));
  return donation||combined||main||settingsTarget();
}

function putQr(host:HTMLElement,target:string,preview=false){
  let img=host.querySelector<HTMLImageElement>("img[data-hassoun-donation-qr='1']");
  if(!target){
    img?.remove();
    if(!host.textContent?.trim())host.textContent="▦";
    return;
  }
  if(!img){
    host.textContent="";
    img=document.createElement("img");
    img.dataset.hassounDonationQr="1";
    img.alt="QR code for masjid donation or website link";
    img.style.cssText=preview
      ?"display:block;width:82px;height:82px;max-width:86%;object-fit:contain;background:#fff;padding:4px;border-radius:8px;margin:10px auto"
      :"display:block;width:132px;height:132px;max-width:88%;object-fit:contain;background:#fff;padding:6px;border-radius:10px;margin:10px auto";
    host.appendChild(img);
  }
  const src=qrUrl(target,preview?220:300);
  if(img.src!==src)img.src=src;
  host.setAttribute("data-qr-target",target);
}

function syncSourceTv(){
  document.querySelectorAll<HTMLElement>(".tv-donation").forEach(panel=>{
    const strong=panel.querySelector<HTMLElement>("strong");
    const visible=normalizeUrl(strong?.textContent||"");
    const target=settingsTarget()||visible;
    const mark=panel.querySelector<HTMLElement>(".donation-mark");
    if(mark)putQr(mark,target,false);
  });
}

function syncReplicaPreview(){
  const target=targetFromEditor();
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const donation=buttons.find(b=>{
    const t=(b.textContent||"").toLowerCase();
    return t.includes("support your masjid")||t.includes("add website link")||t.includes("donation");
  });
  if(!donation)return;
  let mark=Array.from(donation.querySelectorAll<HTMLElement>("div,span")).find(x=>(x.textContent||"").trim()==="▦"||x.dataset.hassounQrHost==="1")||null;
  if(!mark){
    mark=document.createElement("div");
    mark.dataset.hassounQrHost="1";
    donation.insertBefore(mark,donation.querySelector("small")||null);
  }
  mark.dataset.hassounQrHost="1";
  putQr(mark,target,true);
}

function syncReplicaOne(){
  document.querySelectorAll<HTMLElement>(".replica-donation").forEach(panel=>{
    const website=normalizeUrl(panel.querySelector<HTMLElement>(".replica-website strong")?.textContent||"");
    const target=settingsTarget()||website;
    const host=panel.querySelector<HTMLElement>(".replica-qr");
    if(host)putQr(host,target,false);
  });
}

function syncPixelReplica(){
  const target=settingsTarget();
  if(!target)return;
  document.querySelectorAll<HTMLElement>(".pixel-replica-one").forEach(root=>{
    const placeholders=Array.from(root.querySelectorAll<HTMLElement>("div")).filter(x=>(x.textContent||"").trim()==="▦");
    placeholders.forEach(host=>{
      host.style.lineHeight="normal";
      host.style.display="flex";
      host.style.alignItems="center";
      host.style.justifyContent="center";
      host.style.padding=".35vw";
      host.style.boxSizing="border-box";
      putQr(host,target,false);
      const img=host.querySelector<HTMLImageElement>("img[data-hassoun-donation-qr='1']");
      if(img)img.style.cssText="display:block;width:100%;height:100%;object-fit:contain;background:#fff;padding:.25vw;border-radius:.45vw;box-sizing:border-box;margin:0";
    });
  });
}

export default function DonationQrEnhancer(){
  useEffect(()=>{
    const sync=()=>{syncSourceTv();syncReplicaPreview();syncReplicaOne();syncPixelReplica()};
    sync();
    const timer=window.setInterval(sync,500);
    const observer=new MutationObserver(sync);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    return()=>{window.clearInterval(timer);observer.disconnect()};
  },[]);
  return null;
}
