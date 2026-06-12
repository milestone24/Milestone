import { useEffect, useState } from "react";
import { useViewport } from "../../platform/PlatformServicesProvider";

export function useMobile(breakpoint = 768) {
  const viewport = useViewport();
  const [isMobile, setIsMobile] = useState(() => viewport.getIsMobile());

  useEffect(() => {
    return viewport.subscribe(setIsMobile);
  }, [viewport]);

  return isMobile;
}
