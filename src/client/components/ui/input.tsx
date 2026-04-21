import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "~/client/components/ui/lib";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-8 w-full min-w-0 rounded border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-[background-color,border-color,color,box-shadow] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:shadow-[0_0_0_3px_rgba(80,223,170,0.12)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgba(255,95,86,0.12)] md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:disabled:bg-input/80",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
