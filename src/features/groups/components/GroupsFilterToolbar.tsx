import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import type { Group } from '../../../shared/schemas';
import type { TaskFilter } from '../../tasks/utils/task-sort';
import { es } from '../../../shared/i18n';

export interface GroupsFilterToolbarProps {
  groups: Group[];
  selectedGroupIds: string[];
  searchQuery: string;
  activeFilter: TaskFilter;
  counts: { pending: number; completed: number; all: number };
  isApiMode?: boolean;
  activeTabHasMore?: boolean;
  groupsHasNext?: boolean;
  isLoadingMoreGroups?: boolean;
  onLoadMoreGroups?: () => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (filter: TaskFilter) => void;
  onToggleGroup: (groupId: string) => void;
  onSelectAllGroups: () => void;
  onCreateGroup: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function GroupsFilterToolbar({
  groups,
  selectedGroupIds,
  searchQuery,
  activeFilter,
  counts,
  isApiMode = false,
  activeTabHasMore = false,
  groupsHasNext = false,
  isLoadingMoreGroups = false,
  onLoadMoreGroups,
  onSearchChange,
  onFilterChange,
  onToggleGroup,
  onSelectAllGroups,
  onCreateGroup,
  onRefresh,
  isRefreshing = false,
}: GroupsFilterToolbarProps) {
  const formatTabLabel = (filter: TaskFilter, baseLabel: string, count: number): string => {
    if (!isApiMode) {
      return `${baseLabel} (${count})`;
    }
    if (activeFilter !== filter) {
      return baseLabel;
    }
    return `${baseLabel} (${count}${activeTabHasMore ? '+' : ''})`;
  };

  return (
    <div className="d-flex flex-column gap-3 mb-4">
      {/* Top Row: Search Input & Action Buttons */}
      <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center justify-content-between gap-2">
        <div className="flex-grow-1" style={{ maxWidth: '500px' }}>
          <InputGroup>
            <InputGroup.Text id="search-addon" className="bg-white">
              🔍
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder={es.groups.searchPlaceholder}
              aria-label="Buscar tareas"
              aria-describedby="search-addon"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="outline-secondary"
                onClick={() => onSearchChange('')}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </Button>
            )}
          </InputGroup>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Button variant="primary" onClick={onCreateGroup}>
            + {es.groups.createGroupButton}
          </Button>
          <Button
            variant="outline-secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={es.groups.refreshTooltip}
          >
            {isRefreshing ? es.common.loading : es.groups.refreshButton}
          </Button>
        </div>
      </div>

      {/* Middle Row: Status Filter Tabs */}
      <div>
        <Nav variant="pills" className="gap-2" role="tablist">
          <Nav.Item>
            <Nav.Link
              active={activeFilter === 'pendientes'}
              onClick={() => onFilterChange('pendientes')}
              className="px-3 py-1 fw-semibold cursor-pointer"
              role="tab"
              aria-selected={activeFilter === 'pendientes'}
            >
              {formatTabLabel('pendientes', es.tasks.filterPending, counts.pending)}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeFilter === 'completadas'}
              onClick={() => onFilterChange('completadas')}
              className="px-3 py-1 fw-semibold cursor-pointer"
              role="tab"
              aria-selected={activeFilter === 'completadas'}
            >
              {formatTabLabel('completadas', es.tasks.filterCompleted, counts.completed)}
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              active={activeFilter === 'todas'}
              onClick={() => onFilterChange('todas')}
              className="px-3 py-1 fw-semibold cursor-pointer"
              role="tab"
              aria-selected={activeFilter === 'todas'}
            >
              {formatTabLabel('todas', es.tasks.filterAll, counts.all)}
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </div>

      {/* Bottom Row: Multi-Group Selection Pills */}
      <div className="d-flex align-items-center flex-wrap gap-2 pt-1 border-top">
        <span className="small text-muted fw-semibold me-1">
          {es.groups.filterGroupLabel}:
        </span>
        <Button
          variant={selectedGroupIds.length === 0 ? 'dark' : 'outline-secondary'}
          size="sm"
          className="rounded-pill px-3"
          onClick={onSelectAllGroups}
        >
          {es.groups.allGroupsOption}
        </Button>
        {groups.map((group) => {
          const isSelected = selectedGroupIds.includes(group.id);
          return (
            <Button
              key={group.id}
              variant={isSelected ? 'dark' : 'outline-secondary'}
              size="sm"
              className="rounded-pill px-3"
              onClick={() => onToggleGroup(group.id)}
            >
              {group.name}
            </Button>
          );
        })}
        {groupsHasNext && onLoadMoreGroups && (
          <Button
            variant="outline-primary"
            size="sm"
            className="rounded-pill px-3"
            disabled={isLoadingMoreGroups}
            onClick={onLoadMoreGroups}
          >
            {isLoadingMoreGroups ? es.common.loadingMore : es.groups.loadMoreGroups}
          </Button>
        )}
      </div>
    </div>
  );
}
