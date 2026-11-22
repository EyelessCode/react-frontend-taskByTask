import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { es } from '../../../shared/i18n';
import { useNotifications } from '../hooks';

export function NotificationPermissionBanner() {
  const {
    permissionState,
    isPermissionBannerVisible,
    pushStatus,
    requestPermission,
    dismissPermissionBanner,
  } = useNotifications();

  if (
    !isPermissionBannerVisible ||
    pushStatus === 'disabled-by-server' ||
    pushStatus === 'unavailable' ||
    pushStatus === 'unsupported' ||
    (permissionState !== 'default' && permissionState !== 'denied')
  ) {
    return null;
  }

  if (permissionState === 'denied') {
    return (
      <Alert
        variant="warning"
        role="region"
        aria-label={es.notifications.permissionBlockedTitle}
        className="mb-3 py-2 px-3"
      >
        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
          <div className="small">
            <div className="fw-semibold">{es.notifications.permissionBlockedTitle}</div>
            <div>{es.notifications.permissionBlockedInstructions}</div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Button
              variant="outline-secondary"
              size="sm"
              type="button"
              onClick={() => {
                void dismissPermissionBanner();
              }}
            >
              {es.notifications.dismissReminderButton}
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Alert
      variant="info"
      role="region"
      aria-label={es.notifications.permissionPromptTitle}
      className="mb-3 py-2 px-3"
    >
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
        <div className="small">
          <div className="fw-semibold">{es.notifications.permissionPromptTitle}</div>
          <div>{es.notifications.permissionPromptBody}</div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={() => {
              void requestPermission();
            }}
          >
            {es.notifications.enableNotificationsButton}
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            type="button"
            onClick={() => {
              void dismissPermissionBanner();
            }}
          >
            {es.notifications.dismissReminderButton}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
