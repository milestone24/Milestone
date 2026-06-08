import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";

type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  textClassName?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary",
  outline: "border border-border bg-transparent",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
};

const textVariantClasses: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "px-4 py-2 rounded-md",
  sm: "px-3 py-1.5 rounded-md",
  lg: "px-6 py-3 rounded-lg",
  icon: "w-10 h-10 rounded-full items-center justify-center",
};

export function Button({
  variant = "default",
  size = "default",
  label,
  children,
  className,
  textClassName,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center",
        variantClasses[variant],
        sizeClasses[size],
        disabled && "opacity-50",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {label ? (
        <Text className={cn("font-medium text-sm", textVariantClasses[variant], textClassName)}>
          {label}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
