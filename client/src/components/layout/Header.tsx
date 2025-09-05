import {
  User,
  Settings,
  Link as LinkIcon,
  LogOut,
  Bell,
  X,
  Trophy,
  Wallet,
  Flag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import { useSession } from "@/hooks/use-session";
import { useState, useRef, useEffect } from "react";

// Define notification interface
interface Notification {
  id: number | string;
  title: string;
  message: string;
  isRead: boolean;
  isNew?: boolean;
  isExiting?: boolean; // For exit animation when dismissing
}

// Notification Item Component
const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkAsRead: (id: number | string) => void;
  onDismiss: (id: number | string) => void;
}) => {
  const notificationRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef<number | null>(null);

  // Setup touch handlers for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startXRef.current) return;
    currentXRef.current = e.touches[0]?.clientX ?? null;

    const diffX = currentXRef.current
      ? currentXRef.current - startXRef.current
      : 0;
    if (Math.abs(diffX) > 10) {
      // Threshold to start moving
      // Apply transform to move notification horizontally
      if (notificationRef.current) {
        notificationRef.current.style.transform = `translateX(${diffX}px)`;

        // Add opacity effect as it's swiped further
        const opacity = Math.max(0, 1 - Math.abs(diffX) / 200);
        notificationRef.current.style.opacity = opacity.toString();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!startXRef.current || !currentXRef.current) return;

    const diffX = currentXRef.current - startXRef.current;

    // If swiped far enough, dismiss the notification
    if (Math.abs(diffX) > 100) {
      // Threshold to trigger dismiss
      onDismiss(notification.id);
    } else if (notificationRef.current) {
      // Reset position if not dismissed
      notificationRef.current.style.transform = "";
      notificationRef.current.style.opacity = "1";
    }

    // Reset refs
    startXRef.current = null;
    currentXRef.current = null;
  };

  // Determine which icon to display based on notification title
  const getNotificationIcon = () => {
    const title = notification.title.toLowerCase();

    if (title.includes("milestone") && title.includes("portfolio")) {
      return <Trophy className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />;
    } else if (
      title.includes("milestone") &&
      (title.includes("isa") ||
        title.includes("sipp") ||
        title.includes("lisa") ||
        title.includes("gia"))
    ) {
      return <Wallet className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />;
    } else if (title.includes("goal") || title.includes("progress")) {
      return <Flag className="w-5 h-5 text-purple-500 mr-2 flex-shrink-0" />;
    } else {
      return <Bell className="w-5 h-5 text-gray-500 mr-2 flex-shrink-0" />;
    }
  };

  return (
    <div
      ref={notificationRef}
      onClick={() => onMarkAsRead(notification.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative mb-2 p-2 rounded-md text-sm cursor-pointer transition-colors bg-gray-50 hover:bg-gray-100
      ${notification.isNew ? "notification-item-new" : ""}
        ${notification.isExiting ? "notification-item-exiting" : ""}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center flex-grow pr-6">
          <div className="flex items-center justify-center">
            {getNotificationIcon()}
          </div>
          <div className={notification.isRead ? "opacity-70" : "opacity-100"}>
            <p className="font-medium">{notification.title}</p>
            <p className="text-gray-500 text-xs">{notification.message}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default function Header() {
  const { logout, user, profileImage } = useSession();

  // Track notification count and items
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      title: "Total portfolio milestone!",
      message: "Your investments have reached £350,000",
      isRead: false,
      isNew: false,
    },
    {
      id: 2,
      title: "Goal progress update",
      message: "£42,861 more to reach your £400k milestone",
      isRead: false,
      isNew: false,
    },
    {
      id: 3,
      title: "SIPP milestone achieved!",
      message: "Your SIPP has reached £150,000",
      isRead: true,
      isNew: false,
    },
  ]);

  // Compute notification count based on unread items
  const notificationCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Mark a notification as read
  const markAsRead = (id: number | string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  // Dismiss a notification with animation
  const dismissNotification = (id: number | string) => {
    // First set the exiting flag to trigger animation
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isExiting: true } : n))
    );

    // After animation completes, remove the notification
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 300); // Animation duration is 0.3s
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    // Set all to exiting for animation
    setNotifications((prev) => prev.map((n) => ({ ...n, isExiting: true })));

    // After animation completes, remove all
    setTimeout(() => {
      setNotifications([]);
    }, 300);
  };

  // Add a new notification (for testing animation)
  //const addNotification = () => {

  // Sample notification types
  // const notificationTypes = [
  //   "account-milestone",
  //   "portfolio-milestone",
  //   "goal-progress",
  // ];

  // // Choose random notification type
  // const notificationType =
  //   notificationTypes[Math.floor(Math.random() * notificationTypes.length)];

  // let title = "";
  // let message = "";

  // // Generate content based on notification type
  // switch (notificationType) {
  //   case "account-milestone":
  //     // Account milestone notifications (specific accounts reaching round number values)
  //     //TODO account types should come from constants
  //     const accountTypes = ["ISA", "SIPP", "LISA", "GIA"];
  //     const accountType =
  //       accountTypes[Math.floor(Math.random() * accountTypes.length)];
  //     const milestoneValues = [5000, 10000, 25000, 50000, 100000];
  //     const milestoneValue =
  //       milestoneValues[Math.floor(Math.random() * milestoneValues.length)];

  //     title = `${accountType} milestone achieved!`;
  //     message = `Your ${accountType} has reached £${milestoneValue.toLocaleString()}`;
  //     break;

  //   case "portfolio-milestone":
  //     // Portfolio total value milestones
  //     const portfolioMilestones = [
  //       100000, 150000, 200000, 250000, 300000, 350000, 400000,
  //     ];
  //     const portfolioValue =
  //       portfolioMilestones[
  //         Math.floor(Math.random() * portfolioMilestones.length)
  //       ];

  //     title = "Total portfolio milestone!";
  //     message = `Your investments have reached £${portfolioValue.toLocaleString()}`;
  //     break;

  //   case "goal-progress":
  //     // Progress on user-defined goals
  //     const goals = [
  //       { name: "Retirement Fund", target: 500000, current: 357000 },
  //       { name: "House Deposit", target: 50000, current: 42000 },
  //       { name: "Emergency Fund", target: 15000, current: 14500 },
  //     ];

  //     const randomGoal = goals[Math.floor(Math.random() * goals.length)];
  //     const percentage = Math.round(
  //       (randomGoal.current / randomGoal.target) * 100
  //     );

  //     title = `${randomGoal.name}: ${percentage}% complete`;
  //     message = `£${randomGoal.current.toLocaleString()} of £${randomGoal.target.toLocaleString()} goal`;
  //     break;
  // }

  // // Create new notification with unique ID
  // const newNotification = {
  //   id: Date.now(), // Use timestamp as unique ID
  //   title,
  //   message,
  //   isRead: false,
  //   isNew: true, // Flag as new for animation
  // };

  // // Add to notifications list
  // setNotifications([newNotification, ...notifications]);

  // // After 500ms, remove the "new" flag to stop the animation
  // setTimeout(() => {
  //   setNotifications((prev) =>
  //     prev.map((n) =>
  //       n.id === newNotification.id ? { ...n, isNew: false } : n
  //     )
  //   );
  // }, 500);
  //};

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-gray-100 text-gray-500">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                )}
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/api-connections" className="cursor-pointer">
                  <LinkIcon className="w-4 h-4 mr-2" /> API Connections
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Link to="/portfolio" className="flex-1 text-center">
          <h1 className="text-xl font-semibold text-neutral-900 inline-block cursor-pointer hover:text-blue-500 transition-colors">
            Milestone
          </h1>
        </Link>

        <div className="flex-1 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-neutral-700 hover:text-neutral-900 rounded-full p-1 hover:bg-gray-100 relative">
              <Bell className="w-6 h-6" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center notification-badge">
                  {notificationCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="flex justify-between items-center px-4 py-2">
                <div className="text-sm font-medium">Notifications</div>
                {notificationCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />

              <div className="px-2 py-1 max-h-80 overflow-auto">
                {notifications.length > 0 ? (
                  <>
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onDismiss={dismissNotification}
                      />
                    ))}
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    No new notifications
                  </div>
                )}

                {/* Button row at the bottom */}
                <div className="flex space-x-2 mt-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllNotifications();
                      }}
                      className="flex-1 py-1 px-2 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      Clear all
                    </button>
                  )}

                  {/* Test button - only visible in development */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent dropdown from closing
                      //addNotification();
                    }}
                    className="flex-1 py-1 px-2 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Simulate new
                  </button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
