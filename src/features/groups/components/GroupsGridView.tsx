import { useState, useEffect, useRef } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';

import { useGroups } from '../hooks/use-groups';
import { useTasks } from '../../tasks/hooks/use-tasks';
import { useAuth } from '../../auth/hooks';
import { useNotifications } from '../../notifications/hooks';
import {
  NotificationCenterButton,
  NotificationCenterPanel,
  NotificationPermissionBanner,
} from '../../notifications/components';

import { GroupCard } from './GroupCard';
import { GroupsFilterToolbar } from './GroupsFilterToolbar';
import { GroupFormModal } from './GroupFormModal';
import { GroupDeleteConfirmModal } from './GroupDeleteConfirmModal';

import { TaskFormModal } from '../../tasks/components/TaskFormModal';
import { TaskMoveCopyModal } from '../../tasks/components/TaskMoveCopyModal';
import { TaskDeleteConfirmModal } from '../../tasks/components/TaskDeleteConfirmModal';
import { TaskTagRemovalModal } from '../../tasks/components/TaskTagRemovalModal';

import { es } from '../../../shared/i18n';

export interface GroupsGridViewProps {
  onNavigateToProfile?: () => void;
  onLoggedOut?: () => void;
}

export function GroupsGridView({
  onNavigateToProfile,
  onLoggedOut,
}: GroupsGridViewProps = {}) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const timeFormat = currentUser?.timeFormat ?? '24h';
  const timeZone = currentUser?.timeZone;

  const {
    groups,
    visibleGroups,
    tasks: allTasks,
    tags,
    selectedGroupIds,
    searchQuery,
    activeFilter,
    modalState: groupModalState,
    isLoading,
    error,
    counts,
    isApiMode,
    groupsHasNext,
    isLoadingMoreGroups,
    groupTaskPages,
    activeTabHasMore,
    globalSearchHasMatches,
    getGroupTasks,
    init,
    deleteGroup,
    refresh,
    loadMoreGroups,
    loadMoreGroupTasks,
    setSelectedGroupIds,
    toggleGroupId,
    setSearchQuery,
    setActiveFilter,
    openModal: openGroupModal,
    closeModal: closeGroupModal,
  } = useGroups();

  const {
    activeGroupId,
    modalState: taskModalState,
    init: tasksInit,
    setActiveGroup: tasksSetActiveGroup,
    openModal: tasksOpenModal,
    closeModal: tasksCloseModal,
    toggleTaskComplete,
    removeTagFromTask,
    deleteTagFromGroup,
  } = useTasks();

  const [inlineGroupId, setInlineGroupId] = useState<string | null>(null);
  const lastRemovalTaskIdRef = useRef<string | null>(null);
  const { init: notificationsInit, refresh: notificationsRefresh } = useNotifications();
  const activeUserId = currentUser?.id ?? null;

  useEffect(() => {
    void (async () => {
      await init();
      await tasksInit();
      if (isAuthenticated && activeUserId) {
        await notificationsInit();
      }
    })();
  }, [init, tasksInit, notificationsInit, isAuthenticated, activeUserId]);

  const activeGroup =
    groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null;

  const activeLoadedCount =
    activeFilter === 'pendientes'
      ? counts.pending
      : activeFilter === 'completadas'
        ? counts.completed
        : counts.all;

  const isGlobalSearchEmpty = isApiMode
    ? searchQuery.trim().length > 0 &&
      activeLoadedCount === 0 &&
      !globalSearchHasMatches &&
      !isLoading
    : searchQuery.trim().length > 0 && counts.all === 0;

  const activeTaskModalTask = taskModalState.taskId
    ? allTasks.find((t) => t.id === taskModalState.taskId) ?? null
    : null;

  return (
    <Container className="py-4" fluid="lg">
      {/* Header */}
      <header className="mb-4">
        {isAuthenticated && currentUser && (
          <>
            <nav
              aria-label="Cuenta"
              className="d-flex align-items-center justify-content-between flex-wrap gap-2 py-2 px-3 mb-3 bg-light rounded border"
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
              onChange={(e) => tasksSetActiveGroup(e.target.value)}
              className="fw-semibold text-secondary"
              style={{ minWidth: '130px', width: 'auto' }}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>

        {activeGroup && (
          <div className="small text-muted">
            <span>Grupo activo: </span>
            <span className="fw-semibold text-dark">{activeGroup.name}</span>
          </div>
        )}
      </header>

      {/* Global Error Alert */}
      {error && (
        <Alert variant="danger" dismissible>
          {error}
        </Alert>
      )}

      {/* Filter and Action Toolbar */}
      <GroupsFilterToolbar
        groups={groups}
        selectedGroupIds={selectedGroupIds}
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        counts={counts}
        isApiMode={isApiMode}
        activeTabHasMore={activeTabHasMore}
        groupsHasNext={groupsHasNext}
        isLoadingMoreGroups={isLoadingMoreGroups}
        onLoadMoreGroups={() => {
          void loadMoreGroups();
        }}
        onSearchChange={setSearchQuery}
        onFilterChange={setActiveFilter}
        onToggleGroup={toggleGroupId}
        onSelectAllGroups={() => setSelectedGroupIds([])}
        onCreateGroup={() => openGroupModal('create')}
        onRefresh={() => {
          void (async () => {
            await refresh();
            if (isAuthenticated && activeUserId) {
              await notificationsRefresh();
            }
          })();
        }}
        isRefreshing={isLoading}
      />

      {/* Global Search Empty Alert Banner (REQ-GRP-23) */}
      {isGlobalSearchEmpty && (
        <Alert variant="info" className="mb-3">
          {es.groups.emptySearchGlobal}
        </Alert>
      )}

      {/* Groups Grid Layout (REQ-GRP-12, UI-02) */}
      {isLoading && groups.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">{es.common.loading}</p>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <p>{es.groups.noGroupsFound}</p>
        </div>
      ) : (
        <>
          <Row xs={1} md={2} lg={3} className="g-3">
            {visibleGroups.map((group) => (
              <Col key={group.id}>
                <GroupCard
                  group={group}
                  tasks={getGroupTasks(group.id)}
                  tags={tags}
                  hasMoreTasks={groupTaskPages[group.id]?.hasNext ?? false}
                  isLoadingMoreTasks={groupTaskPages[group.id]?.isLoadingMore ?? false}
                  onLoadMoreTasks={(groupId) => {
                    void loadMoreGroupTasks(groupId);
                  }}
                  timeFormat={timeFormat}
                  timeZone={timeZone}
                  onAddTask={(groupId) => {
                    setInlineGroupId(groupId);
                    tasksSetActiveGroup(groupId);
                    tasksOpenModal('create');
                  }}
                  onRenameGroup={(grp) => openGroupModal('rename', grp)}
                  onDeleteGroup={(grp) => openGroupModal('delete', grp)}
                  onToggleComplete={async (taskId) => {
                    await toggleTaskComplete(taskId);
                    await refresh();
                  }}
                  onEditTask={(task) => tasksOpenModal('edit', task.id)}
                  onMoveTask={(task) => tasksOpenModal('move', task.id)}
                  onCopyTask={(task) => tasksOpenModal('copy', task.id)}
                  onDeleteTask={(task) => tasksOpenModal('delete', task.id)}
                  onRemoveTag={(task, tag) => {
                    lastRemovalTaskIdRef.current = task.id;
                    tasksOpenModal('tagRemoval', task.id, {
                      tagId: tag.id,
                      tagName: tag.name,
                    });
                  }}
                />
              </Col>
            ))}
          </Row>

          {groupsHasNext && (
            <div className="d-flex justify-content-center mt-4">
              <Button
                variant="outline-primary"
                disabled={isLoadingMoreGroups}
                onClick={() => {
                  void loadMoreGroups();
                }}
              >
                {isLoadingMoreGroups ? es.common.loadingMore : es.groups.loadMoreGroups}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Group Modals */}
      <GroupFormModal
        show={
          groupModalState.type === 'create' ||
          groupModalState.type === 'rename'
        }
        group={groupModalState.group}
        onClose={closeGroupModal}
        onSuccess={refresh}
      />

      <GroupDeleteConfirmModal
        show={groupModalState.type === 'delete'}
        group={groupModalState.group}
        onClose={closeGroupModal}
        onConfirm={async (group) => {
          await deleteGroup(group.id);
          closeGroupModal();
        }}
      />

      {/* Task Modals */}
      <TaskFormModal
        show={
          taskModalState.type === 'create' || taskModalState.type === 'edit'
        }
        timeFormat={timeFormat}
        task={activeTaskModalTask}
        defaultGroupId={inlineGroupId ?? activeGroupId}
        onClose={() => {
          setInlineGroupId(null);
          tasksCloseModal();
        }}
        onSuccess={refresh}
        onTagMutated={refresh}
      />

      <TaskMoveCopyModal
        show={
          taskModalState.type === 'move' || taskModalState.type === 'copy'
        }
        mode={taskModalState.type === 'move' ? 'move' : 'copy'}
        task={activeTaskModalTask}
        onClose={tasksCloseModal}
        onSuccess={refresh}
      />

      <TaskDeleteConfirmModal
        show={taskModalState.type === 'delete'}
        task={activeTaskModalTask}
        onClose={tasksCloseModal}
        onSuccess={refresh}
      />

      <TaskTagRemovalModal
        show={taskModalState.type === 'tagRemoval'}
        tagName={taskModalState.tagName ?? null}
        onClose={tasksCloseModal}
        onExited={() => {
          const taskId = lastRemovalTaskIdRef.current;
          lastRemovalTaskIdRef.current = null;
          if (taskId) {
            document.getElementById(`task-check-${taskId}`)?.focus();
          }
        }}
        onRemoveOnlyFromTask={async () => {
          if (taskModalState.taskId && taskModalState.tagId) {
            await removeTagFromTask(
              taskModalState.taskId,
              taskModalState.tagId,
            );
            await refresh();
          }
        }}
        onRemoveFromGroup={async () => {
          if (taskModalState.tagId) {
            await deleteTagFromGroup(taskModalState.tagId);
            await refresh();
          }
        }}
      />

      {isAuthenticated && currentUser && <NotificationCenterPanel />}
    </Container>
  );
}
