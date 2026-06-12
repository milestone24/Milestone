import { useState, useEffect } from 'react';
import { usePlatformDetection } from "../../platform/PlatformServicesProvider";

export function useMobilePlatform() {
  const platformDetection = usePlatformDetection();
  return platformDetection.isNativePlatform();
}