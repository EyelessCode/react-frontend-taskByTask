import { useEffect } from 'react';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { useTasks } from '../hooks/use-tasks';
import { TaskFilterTabs } from './TaskFilterTabs';
import { TaskList } from './TaskList';
import { TaskFormModal } from './TaskFormModal';
import { TaskMoveCopyModal } from './TaskMoveCopyModal';
import { TaskDeleteConfirmModal } from './TaskDeleteConfirmModal';
import { TaskTagRemovalModal } from './TaskTagRemovalModal';
import { es } from '../../../shared/i18n';

export function TasksView() {
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

  useEffect(() => {
    init();
  }, [init]);

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
            onToggleComplete={toggleTaskComplete}
            onEdit={(task) => openModal('edit', task.id)}
            onMove={(task) => openModal('move', task.id)}
            onCopy={(task) => openModal('copy', task.id)}
            onDelete={(task) => openModal('delete', task.id)}
          />
        </main>
      )}

      {/* Modals */}
      <TaskFormModal
        show={modalState.type === 'create' || modalState.type === 'edit'}
        task={modalState.type === 'edit' ? activeModalTask : null}
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
        onRemoveOnlyFromTask={() => {
          if (modalState.taskId && modalState.tagId) {
            removeTagFromTask(modalState.taskId, modalState.tagId);
          }
        }}
        onRemoveFromGroup={() => {
          if (modalState.tagId) {
            deleteTagFromGroup(modalState.tagId);
          }
        }}
      />
    </Container>
  );
}
