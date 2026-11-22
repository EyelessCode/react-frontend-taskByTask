import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { es } from '../../../shared/i18n';
import { formatZonedDateTime } from '../../../shared/utils';
import { useAuth } from '../../auth/hooks';
import { useNotifications } from '../hooks';

export function NotificationCenterPanel() {
  const { currentUser } = useAuth();
  const {
    notifications,
    unreadCount,
    permissionState,
    isCenterOpen,
    isLoadingMore,
    hasNext,
    pushStatus,
    closeCenter,
    requestPermission,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMoreNotifications,
  } = useNotifications();

  const timeZone = currentUser?.timeZone ?? 'UTC';
  const timeFormat = currentUser?.timeFormat ?? '24h';

  return (
    <Modal
      show={isCenterOpen}
      onHide={closeCenter}
      scrollable
      fullscreen="sm-down"
      aria-labelledby="notification-center-title"
    >
      <Modal.Header closeButton closeLabel={es.notifications.closeCenterAria}>
        <Modal.Title id="notification-center-title" as="h2" className="h5 mb-0">
          {es.notifications.centerTitle}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Discrete Browser Permission Status Section (RF-27, REQ-NT-14, REQ-BI-21) */}
        <div className="p-2 mb-3 bg-light rounded border small">
          {pushStatus === 'disabled-by-server' ? (
            <div className="text-muted" role="status">
              {es.notifications.pushDisabledByServer}
            </div>
          ) : pushStatus === 'unavailable' ? (
            <div className="text-muted" role="status">
              {es.notifications.pushUnavailableStatus}
            </div>
          ) : pushStatus === 'subscription-error' ? (
            <div className="text-warning-emphasis" role="status">
              {es.notifications.pushSubscriptionError}
            </div>
          ) : pushStatus === 'unsupported' || permissionState === 'unsupported' ? (
            <div className="text-muted">{es.notifications.permissionUnsupportedNote}</div>
          ) : (
            <>
              {permissionState === 'granted' && (
                <div className="text-success fw-medium">
                  {es.notifications.permissionGrantedStatus}
                </div>
              )}

              {permissionState === 'default' && (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <span className="text-secondary fw-medium">
                    {es.notifications.permissionDefaultStatus}
                  </span>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    type="button"
                    onClick={() => {
                      void requestPermission();
                    }}
                  >
                    {es.notifications.enableNotificationsButton}
                  </Button>
                </div>
              )}

              {permissionState === 'denied' && (
                <div>
                  <div className="text-warning-emphasis fw-semibold mb-1">
                    {es.notifications.permissionDeniedStatus}
                  </div>
                  <div className="text-muted">
                    {es.notifications.permissionBlockedInstructions}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions Toolbar */}
        <div className="d-flex justify-content-end mb-3">
          <Button
            variant="outline-secondary"
            size="sm"
            type="button"
            disabled={unreadCount === 0}
            aria-label={es.notifications.markAllAsReadAria}
            onClick={() => {
              void markAllAsRead();
            }}
          >
            {es.notifications.markAllAsReadButton}
          </Button>
        </div>

        {/* Notifications List or Empty State */}
        {notifications.length === 0 ? (
          <p className="text-muted text-center py-4 mb-0">{es.notifications.emptyState}</p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded border ${
                  !item.read ? 'border-primary bg-light' : 'bg-white'
                }`}
              >
                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                  <span className="text-muted small">
                    {formatZonedDateTime(item.createdAt, timeZone, timeFormat)}
                  </span>
                  {!item.read && (
                    <Badge bg="primary">{es.notifications.unreadBadge}</Badge>
                  )}
                </div>
                <p className="mb-2 small fw-medium text-dark">{item.content}</p>
                <div className="d-flex align-items-center justify-content-end gap-3">
                  {!item.read && (
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      className="p-0 text-decoration-none small"
                      aria-label={es.notifications.markAsReadAria}
                      onClick={() => {
                        void markAsRead(item.id);
                      }}
                    >
                      {es.notifications.markAsReadButton}
                    </Button>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    className="p-0 text-danger text-decoration-none small"
                    aria-label={es.notifications.deleteAria}
                    onClick={() => {
                      void deleteNotification(item.id);
                    }}
                  >
                    {es.notifications.deleteButton}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasNext && (
          <div className="mt-3">
            <Button
              variant="outline-primary"
              size="sm"
              type="button"
              className="w-100"
              disabled={isLoadingMore}
              onClick={() => {
                void loadMoreNotifications();
              }}
            >
              {isLoadingMore ? es.common.loadingMore : es.notifications.loadMoreNotifications}
            </Button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
