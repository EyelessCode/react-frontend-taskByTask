import { useNotificationsStore } from '../store';

export function useNotifications() {
  const notifications = useNotificationsStore((state) => state.notifications);
  const unreadCount = useNotificationsStore((state) => state.unreadCount);
  const permissionState = useNotificationsStore((state) => state.permissionState);
  const isPermissionBannerVisible = useNotificationsStore(
    (state) => state.isPermissionBannerVisible,
  );
  const isCenterOpen = useNotificationsStore((state) => state.isCenterOpen);
  const isLoading = useNotificationsStore((state) => state.isLoading);
  const isLoadingMore = useNotificationsStore((state) => state.isLoadingMore);
  const hasNext = useNotificationsStore((state) => state.hasNext);
  const pushStatus = useNotificationsStore((state) => state.pushStatus);
  const error = useNotificationsStore((state) => state.error);

  const init = useNotificationsStore((state) => state.init);
  const refresh = useNotificationsStore((state) => state.refresh);
  const openCenter = useNotificationsStore((state) => state.openCenter);
  const closeCenter = useNotificationsStore((state) => state.closeCenter);
  const requestPermission = useNotificationsStore((state) => state.requestPermission);
  const dismissPermissionBanner = useNotificationsStore(
    (state) => state.dismissPermissionBanner,
  );
  const markAsRead = useNotificationsStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationsStore((state) => state.markAllAsRead);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);
  const loadMoreNotifications = useNotificationsStore((state) => state.loadMoreNotifications);

  return {
    notifications,
    unreadCount,
    permissionState,
    isPermissionBannerVisible,
    isCenterOpen,
    isLoading,
    isLoadingMore,
    hasNext,
    pushStatus,
    error,
    init,
    refresh,
    openCenter,
    closeCenter,
    requestPermission,
    dismissPermissionBanner,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMoreNotifications,
  };
}
