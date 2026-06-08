import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NoTranslateProps = {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
};

export function NoTranslate({ children, className, as: Tag = "span" }: NoTranslateProps) {
  return (
    <Tag className={cn("notranslate", className)} translate="no">
      {children}
    </Tag>
  );
}
