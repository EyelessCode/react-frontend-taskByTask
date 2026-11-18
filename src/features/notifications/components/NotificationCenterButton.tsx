import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { es } from '../../../shared/i18n';
import { useNotifications } from '../hooks';

export function NotificationCenterButton() {
  const { unreadCount, openCenter } = useNotifications();

  return (
    <Button
      variant="outline-primary"
      size="sm"
      type="button"
      aria-label={es.notifications.centerButtonAria(unreadCount)}
      onClick={() => {
        void openCenter();
      }}
      className="d-inline-flex align-items-center gap-1"
    >
      <span>{es.notifications.centerButtonLabel}</span>
      {unreadCount > 0 && (
        <Badge pill bg="danger" aria-hidden="true">
          {unreadCount}
        </Badge>
      )}
    </Button>
  );
}
