import { useMemo } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

import logoLight from "@/assets/luciddocs-logo-new-cropped.png";
import logoDark from "@/assets/luciddocs-logo-dark.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className, alt = "LucidDocs AI" }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();

  const src = useMemo(() => {
    return resolvedTheme === "dark" ? logoDark : logoLight;
  }, [resolvedTheme]);

  return (
    <img
      src={src}
      alt={alt}
      className={cn("block select-none", className)}
      loading="eager"
      decoding="async"
    />
  );
}
