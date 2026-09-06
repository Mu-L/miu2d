import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const DISMISSED_KEY = "miu2d-domestic-notice-dismissed";
const DOMESTIC_ORIGIN = "https://miu2d.williamchan.me:10443";

export function RegionalSiteNotice() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // 禁用浏览器存储时仍可使用提示。
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/site-region", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const region = await response.json();
        if (!controller.signal.aborted) setVisible(region.suggestDomestic === true);
      })
      .catch(() => {}) // 地区识别失败不影响网站使用。
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!visible) return null;

  const domesticUrl = `${DOMESTIC_ORIGIN}${location.pathname}${location.search}${location.hash}`;
  return (
    <aside
      aria-label="国内访问提示"
      className="fixed inset-x-3 top-3 z-[10000] mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-sky-200 bg-white p-4 text-sm text-slate-800 shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">你正在访问国际站</p>
        <p className="mt-1 text-slate-600">检测到你位于中国大陆，访问国内站可能更流畅。</p>
        <a className="mt-2 inline-block font-semibold text-sky-700 underline" href={domesticUrl}>
          前往国内站
        </a>
      </div>
      <button
        type="button"
        aria-label="关闭国内访问提示，继续访问国际站"
        className="shrink-0 rounded-lg px-2 py-2 text-slate-600 hover:bg-slate-100"
        onClick={() => {
          setVisible(false);
          try {
            sessionStorage.setItem(DISMISSED_KEY, "1");
          } catch {
            // 当前页面内仍可关闭提示。
          }
        }}
      >
        关闭
      </button>
    </aside>
  );
}
