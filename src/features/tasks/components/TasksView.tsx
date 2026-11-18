import { useEffect, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { useTasks } from '../hooks/use-tasks';
import { useAuth } from '../../auth/hooks';
import { useNotifications } from '../../notifications/hooks';
import {
  NotificationCenterButton,
  NotificationCenterPanel,
  NotificationPermissionBanner,
} from '../../notifications/components';
import { TaskFilterTabs } from './TaskFilterTabs';
import { TaskList } from './TaskList';
import { TaskFormModal } from './TaskFormModal';
import { TaskMoveCopyModal } from './TaskMoveCopyModal';
import { TaskDeleteConfirmModal } from './TaskDeleteConfirmModal';
import { TaskTagRemovalModal } from './TaskTagRemovalModal';
import { es } from '../../../shared/i18n';

export interface TasksViewProps {
  onNavigateToProfile?: () => void;
  onLoggedOut?: () => void;
}

export function TasksView({ onNavigateToProfile, onLoggedOut }: TasksViewProps = {}) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const timeFormat = currentUser?.timeFormat ?? '24h';
  const timeZone = currentUser?.timeZone;

  const {
    tasks,
    rawTasks,
    groups,
    tags,
    activeGroupId,
    activeGroup,
    activeFilter,
    isLoading,
    error,
    modalState,
    counts,
    init,
    setActiveGroup,
    setActiveFilter,
    openModal,
    closeModal,
    toggleTaskComplete,
    removeTagFromTask,
    deleteTagFromGroup,
  } = useTasks();

  const lastRemovalTaskIdRef = useRef<string | null>(null);
  const { init: notificationsInit } = useNotifications();
  const activeUserId = currentUser?.id ?? null;

  useEffect(() => {
    void (async () => {
      await init();
      if (isAuthenticated && activeUserId) {
        await notificationsInit();
      }
    })();
  }, [init, notificationsInit, isAuthenticated, activeUserId]);

  const activeModalTask = modalState.taskId
    ? rawTasks.find((t) => t.id === modalState.taskId) ?? null
    : null;

  return (
    <Container className="py-4" style={{ maxWidth: '720px' }}>
      {/* Header */}
      <header className="mb-4">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
          <div>
            <h1 className="h3 fw-bold mb-0 text-primary">{es.app.title}</h1>
            <p className="text-muted small mb-0">{es.app.tagline}</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <Form.Label htmlFor="active-group-select" className="visually-hidden">
              Cambiar grupo activo
            </Form.Label>
            <Form.Select
              id="active-group-select"
              aria-label="Cambiar grupo activo"
              size="sm"
              value={activeGroupId}
              onChange={(e) => setActiveGroup(e.target.value)}
              className="fw-semibold text-secondary"
              style={{ minWidth: '130px', width: 'auto' }}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Form.Select>

            <Button
              variant="primary"
              size="sm"
              className="d-flex align-items-center gap-1 shadow-sm px-3"
              onClick={() => openModal('create')}
            >
              <span>+</span>
              <span>{es.tasks.createTitle}</span>
            </Button>
          </div>
        </div>

        {isAuthenticated && currentUser && (
          <>
            <nav
              aria-label="Cuenta"
              className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-2 px-3 mb-2 bg-light rounded border"
            >
              <span className="small fw-semibold">
                {es.auth.greetingPrefix} {currentUser.displayName}
              </span>
              <div className="d-flex align-items-center gap-2">
                <NotificationCenterButton />
                <Button
                  variant="outline-secondary"
                  size="sm"
                  type="button"
                  onClick={() => onNavigateToProfile?.()}
                >
                  {es.auth.profileLink}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  type="button"
                  onClick={async () => {
                    await logout();
                    onLoggedOut?.();
                  }}
                >
                  {es.auth.logoutButton}
                </Button>
              </div>
            </nav>
            <NotificationPermissionBanner />
          </>
        )}

        {activeGroup && (
          <div className="small text-muted">
            <span>Grupo activo: </span>
            <span className="fw-semibold text-dark">{activeGroup.name}</span>
          </div>
        )}
      </header>

      {/* Global Error Banner */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Filter Tabs */}
      <nav aria-label="Filtros de tareas">
        <TaskFilterTabs
          activeFilter={activeFilter}
          counts={counts}
          onFilterChange={setActiveFilter}
        />
      </nav>

      {/* Loading State or Task List */}
      {isLoading && rawTasks.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" role="status">
            <span className="visually-hidden">{es.common.loading}</span>
          </Spinner>
        </div>
      ) : (
        <main>
          <TaskList
            tasks={tasks}
            tags={tags}
            filter={activeFilter}
            timeFormat={timeFormat}
            timeZone={timeZone}
            onToggleComplete={toggleTaskComplete}
            onEdit={(task) => openModal('edit', task.id)}
            onMove={(task) => openModal('move', task.id)}
            onCopy={(task) => openModal('copy', task.id)}
            onDelete={(task) => openModal('delete', task.id)}
            onRemoveTag={(task, tag) => {
              lastRemovalTaskIdRef.current = task.id;
              openModal('tagRemoval', task.id, { tagId: tag.id, tagName: tag.name });
            }}
          />
        </main>
      )}

      {/* Modals */}
      <TaskFormModal
        show={modalState.type === 'create' || modalState.type === 'edit'}
        task={modalState.type === 'edit' ? activeModalTask : null}
        timeFormat={timeFormat}
        onClose={closeModal}
      />

      <TaskMoveCopyModal
        show={modalState.type === 'move' || modalState.type === 'copy'}
        mode={modalState.type === 'copy' ? 'copy' : 'move'}
        task={activeModalTask}
        onClose={closeModal}
      />

      <TaskDeleteConfirmModal
        show={modalState.type === 'delete'}
        task={activeModalTask}
        onClose={closeModal}
      />

      <TaskTagRemovalModal
        show={modalState.type === 'tagRemoval'}
        tagName={modalState.tagName ?? null}
        onClose={closeModal}
        onExited={() => {
          const taskId = lastRemovalTaskIdRef.current;
          lastRemovalTaskIdRef.current = null;
          if (taskId) {
            document.getElementById(`task-check-${taskId}`)?.focus();
          }
        }}
        onRemoveOnlyFromTask={async () => {
          if (modalState.taskId && modalState.tagId) {
            await removeTagFromTask(modalState.taskId, modalState.tagId);
          }
        }}
        onRemoveFromGroup={async () => {
          if (modalState.tagId) {
            await deleteTagFromGroup(modalState.tagId);
          }
        }}
      />

      {isAuthenticated && currentUser && <NotificationCenterPanel />}
    </Container>
  );
}
