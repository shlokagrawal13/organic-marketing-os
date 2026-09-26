export async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "MarketingOS",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const value = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      value.error?.message || "Cannot connect. Please try again.",
    );
    (error as any).status = res.status;
    throw error;
  }
  return value;
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function uploadAsset(
  path: string,
  data: FormData,
  onProgress: (progress: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.setRequestHeader("X-Requested-With", "MarketingOS");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else
        reject(
          new Error(body.error?.message || "Upload failed. Please try again."),
        );
    };
    xhr.onerror = () =>
      reject(new Error("Cannot connect to the upload service."));
    xhr.ontimeout = () =>
      reject(
        new Error("Upload timed out. Check your connection and try again."),
      );
    xhr.send(data);
  });
}
