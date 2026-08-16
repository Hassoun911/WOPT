"use client";

import { useEffect } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function EmailManageRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("emailManage");
    const token = url.searchParams.get("token");
    if (!id || !token || url.pathname.includes("/email/manage")) return;
    const destination = new URL(`${window.location.origin}${basePath}/email/manage/`);
    destination.searchParams.set("id", id);
    destination.searchParams.set("token", token);
    window.location.replace(destination.toString());
  }, []);
  return null;
}
