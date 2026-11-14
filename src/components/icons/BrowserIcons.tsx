import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  alt?: string;
}

export function ZenIcon({ className = "w-5 h-5", alt = "Zen Browser" }: IconProps) {
  return (
    <img
      src="/zen-browser.png"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function ChromeIcon({ className = "w-5 h-5", alt = "Google Chrome" }: IconProps) {
  return (
    <img
      src="/google-chrome.webp"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function EdgeIcon({ className = "w-5 h-5", alt = "Microsoft Edge" }: IconProps) {
  return (
    <img
      src="/microsoft-edge.webp"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function BraveIcon({ className = "w-5 h-5", alt = "Brave Browser" }: IconProps) {
  return (
    <img
      src="/brave.webp"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function FirefoxIcon({ className = "w-5 h-5", alt = "Mozilla Firefox" }: IconProps) {
  return (
    <img
      src="/firefox.webp"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function OperaIcon({ className = "w-5 h-5", alt = "Opera" }: IconProps) {
  return (
    <img
      src="/opera.webp"
      alt={alt}
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function BrowserIcon({
  browser,
  className = "w-5 h-5",
}: {
  browser: string;
  className?: string;
}) {
  const b = browser.toLowerCase();
  if (b.includes("zen")) return <ZenIcon className={className} />;
  if (b.includes("edge")) return <EdgeIcon className={className} />;
  if (b.includes("brave")) return <BraveIcon className={className} />;
  if (b.includes("firefox")) return <FirefoxIcon className={className} />;
  if (b.includes("opera")) return <OperaIcon className={className} />;
  return <ChromeIcon className={className} />;
}
