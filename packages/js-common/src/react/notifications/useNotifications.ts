import { useNotificationService } from "../../platform/PlatformServicesProvider";
import type { NotificationOptions } from "../../platform/types";

export function useNotifications() {
  const notifications = useNotificationService();

  return {
    notify: (options: NotificationOptions) => notifications.show(options),
    toast: (options: NotificationOptions) => notifications.show(options),
  };
}
