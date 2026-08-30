"use client";

import { ChangeEvent, useEffect } from "react";

const MAX_DIMENSION = 640;

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function compressLogo(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read logo file"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Invalid image file"));
      image.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Image processing unavailable"));
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        try {
          const png = canvas.toDataURL("image/png");
          if (png.length <= 700_000) return resolve(png);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        } catch (error) {
          reject(error);
        }
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function LogoUploadEnhancer() {
  useEffect(() => {
    const enhance = () => {
      if (document.querySelector('[data-masjid-logo-upload="1"]')) return;
      const labels = Array.from(document.querySelectorAll("label"));
      const label = labels.find(el => (el.textContent || "").trim().toLowerCase().startsWith("logo image url"));
      const urlInput = label?.querySelector("input") as HTMLInputElement | null;
      if (!label || !urlInput) return;

      const box = document.createElement("div");
      box.dataset.masjidLogoUpload = "1";
      box.className = "masjid-logo-upload-box";
      box.innerHTML = `
        <div class="masjid-logo-upload-actions">
          <label class="masjid-logo-upload-button">
            <span>Upload logo from device</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
          </label>
          <button type="button" class="masjid-logo-remove-button">Remove logo</button>
        </div>
        <div class="masjid-logo-upload-preview" hidden>
          <img alt="Masjid logo preview" />
          <span>Logo preview</span>
        </div>
        <small>PNG, JPG, WEBP or SVG. The image is resized for the TV and saved on this display.</small>
      `;
      label.insertAdjacentElement("afterend", box);

      const fileInput = box.querySelector('input[type="file"]') as HTMLInputElement;
      const remove = box.querySelector(".masjid-logo-remove-button") as HTMLButtonElement;
      const preview = box.querySelector(".masjid-logo-upload-preview") as HTMLDivElement;
      const previewImage = preview.querySelector("img") as HTMLImageElement;

      const refreshPreview = () => {
        const value = urlInput.value.trim();
        if (!value) {
          preview.hidden = true;
          previewImage.removeAttribute("src");
          return;
        }
        previewImage.src = value;
        preview.hidden = false;
      };

      fileInput.addEventListener("change", async (event) => {
        const target = event.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await compressLogo(file);
          setReactInputValue(urlInput, dataUrl);
          previewImage.src = dataUrl;
          preview.hidden = false;
        } catch {
          alert("That logo could not be loaded. Please try a PNG, JPG, WEBP or SVG image.");
        } finally {
          target.value = "";
        }
      });

      remove.addEventListener("click", () => {
        setReactInputValue(urlInput, "");
        preview.hidden = true;
        previewImage.removeAttribute("src");
      });

      urlInput.addEventListener("input", refreshPreview);
      refreshPreview();
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
