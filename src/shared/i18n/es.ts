export interface LocalizationDictionary {
  app: {
    title: string;
    tagline: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
    back: string;
    close: string;
    loading: string;
  };
  validation: {
    required: (field: string) => string;
    minLength: (field: string, min: number) => string;
    maxLength: (field: string, max: number) => string;
    invalidEmail: string;
    invalidUsername: string;
    invalidCharacters: (forbidden: string) => string;
    uniqueConstraint: (entity: string) => string;
  };
  errors: {
    notFound: (entity: string) => string;
    businessRule: (rule: string) => string;
    corruptedData: string;
    storageQuota: string;
    unexpected: string;
  };
  dateTime: {
    overdue: string;
    today: string;
    tomorrow: string;
    dateFormat: 'dd/mm/aaaa';
  };
  tasks: TasksLocalization;
  groups: GroupsLocalization;
  tags: TagsLocalization;
}

export interface TagsLocalization {
  tagsLabel: string;
  tagsPlaceholder: string;
  tagOverflow: (count: number) => string;
  tagOverflowAria: (count: number) => string;
  editTagAria: (tagName: string) => string;
  editingTagInputAria: (tagName: string) => string;
  editTagHint: string;
  removeTagAria: (tagName: string) => string;
  removeTagTitle: string;
  removeTagPrompt: (tagName: string) => string;
  removeTagDescription: string;
  removeOnlyFromTask: string;
  removeFromGroup: string;
}

export interface GroupsLocalization {
  // Navigation & Toolbar
  gridTitle: string;
  createGroupButton: string;
  searchPlaceholder: string;
  filterGroupLabel: string;
  allGroupsOption: string;
  refreshButton: string;
  refreshTooltip: string;
  addTaskToGroup: string;

  // Group Card & Modals
  personalBadge: string;
  groupMenuAria: string;
  actionRename: string;
  actionDelete: string;
  createModalTitle: string;
  renameModalTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  deleteModalTitle: string;
  deleteModalWarning: (groupName: string) => string;
  cannotDeletePersonal: string;

  // Empty & Feedback States
  emptyGroupTasks: string;
  emptySearchGlobal: string;
  noGroupsFound: string;
  taskCount: (count: number) => string;
}

export interface TasksLocalization {
  createTitle: string;
  editTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  descLabel: string;
  descPlaceholder: string;
  dueDateLabel: string;
  dueTimeLabel: string;
  tagsLabel: string;
  tagsPlaceholder: string;
  groupLabel: string;
  filterPending: string;
  filterCompleted: string;
  filterAll: string;
  actionMenuAria: string;
  actionEdit: string;
  actionMove: string;
  actionCopy: string;
  actionDelete: string;
  deleteTitle: string;
  deleteMessage: string;
  confirmDelete: string;
  cancelDelete: string;
  moveTitle: string;
  copyTitle: string;
  selectGroupLabel: string;
  noOtherGroups: string;
  confirmMove: string;
  confirmCopy: string;
  tagOverflow: (count: number) => string;
  tagOverflowAria: (count: number) => string;
  editTagAria: (tagName: string) => string;
  editingTagInputAria: (tagName: string) => string;
  editTagHint: string;
  removeTagAria: (tagName: string) => string;
  removeTagTitle: string;
  removeTagPrompt: (tagName: string) => string;
  removeTagDescription: string;
  removeOnlyFromTask: string;
  removeFromGroup: string;
  badgeOverdue: string;
  emptyPending: string;
  emptyCompleted: string;
  emptyAll: string;
}

const tagsLocalization = {
  tagsLabel: 'Etiquetas',
  tagsPlaceholder: 'Escribe una etiqueta y presiona coma o punto y coma',
  tagOverflow: (count: number) => `+${count} más`,
  tagOverflowAria: (count: number) =>
    `${count} etiquetas adicionales ocultas. Edita la tarea para ver todas.`,
  editTagAria: (tagName: string) => `Editar etiqueta ${tagName}`,
  editingTagInputAria: (tagName: string) => `Editando etiqueta ${tagName}`,
  editTagHint: 'Haz clic o presiona Enter en una etiqueta para editarla en esta tarea',
  removeTagAria: (tagName: string) => `Quitar etiqueta ${tagName}`,
  removeTagTitle: 'Quitar etiqueta',
  removeTagPrompt: (tagName: string) => `¿Cómo deseas quitar la etiqueta "${tagName}"?`,
  removeTagDescription:
    'Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo. Si eliges "Del grupo", se eliminará permanentemente del grupo y de todas sus tareas.',
  removeOnlyFromTask: 'Solo de la tarea',
  removeFromGroup: 'Del grupo',
} as const satisfies TagsLocalization;

export const es = {
  app: {
    title: 'Task by Task',
    tagline: 'Gestiona tus tareas por grupos y etiquetas',
  },
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    confirm: 'Confirmar',
    back: 'Volver',
    close: 'Cerrar',
    loading: 'Cargando...',
  },
  validation: {
    required: (field: string) => `El campo ${field} es obligatorio`,
    minLength: (field: string, min: number) => `${field} debe tener al menos ${min} caracteres`,
    maxLength: (field: string, max: number) => `${field} no puede exceder ${max} caracteres`,
    invalidEmail: 'El correo electrónico no tiene un formato válido',
    invalidUsername: 'El nombre de usuario solo puede contener letras y números',
    invalidCharacters: (forbidden: string) => `No se permiten los siguientes caracteres: ${forbidden}`,
    uniqueConstraint: (entity: string) => `Ya existe un registro con este ${entity}`,
  },
  errors: {
    notFound: (entity: string) => `${entity} no encontrado/a`,
    businessRule: (rule: string) => `Acción no permitida: ${rule}`,
    corruptedData: 'Los datos almacenados están dañados o tienen un formato no válido',
    storageQuota: 'El almacenamiento del navegador está lleno',
    unexpected: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
  },
  dateTime: {
    overdue: 'Vencida',
    today: 'Hoy',
    tomorrow: 'Mañana',
    dateFormat: 'dd/mm/aaaa',
  },
  tasks: {
    createTitle: 'Nueva tarea',
    editTitle: 'Editar tarea',
    titleLabel: 'Título',
    titlePlaceholder: 'Escribe el título de la tarea',
    descLabel: 'Descripción',
    descPlaceholder: 'Añade una descripción (opcional)',
    dueDateLabel: 'Fecha de caducidad',
    dueTimeLabel: 'Hora de caducidad',
    tagsLabel: tagsLocalization.tagsLabel,
    tagsPlaceholder: tagsLocalization.tagsPlaceholder,
    groupLabel: 'Grupo',
    filterPending: 'Pendientes',
    filterCompleted: 'Completadas',
    filterAll: 'Todas',
    actionMenuAria: 'Opciones de la tarea',
    actionEdit: 'Editar',
    actionMove: 'Mover a…',
    actionCopy: 'Copiar a…',
    actionDelete: 'Eliminar',
    deleteTitle: 'Eliminar tarea',
    deleteMessage:
      '¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.',
    confirmDelete: 'Eliminar',
    cancelDelete: 'Cancelar',
    moveTitle: 'Mover tarea',
    copyTitle: 'Copiar tarea',
    selectGroupLabel: 'Seleccionar grupo destino',
    noOtherGroups:
      'No tienes otros grupos individuales disponibles para mover o copiar esta tarea.',
    confirmMove: 'Mover',
    confirmCopy: 'Copiar',
    tagOverflow: tagsLocalization.tagOverflow,
    tagOverflowAria: tagsLocalization.tagOverflowAria,
    editTagAria: tagsLocalization.editTagAria,
    editingTagInputAria: tagsLocalization.editingTagInputAria,
    editTagHint: tagsLocalization.editTagHint,
    removeTagAria: tagsLocalization.removeTagAria,
    removeTagTitle: tagsLocalization.removeTagTitle,
    removeTagPrompt: tagsLocalization.removeTagPrompt,
    removeTagDescription: tagsLocalization.removeTagDescription,
    removeOnlyFromTask: tagsLocalization.removeOnlyFromTask,
    removeFromGroup: tagsLocalization.removeFromGroup,
    badgeOverdue: 'Vencida',
    emptyPending: 'No hay tareas pendientes en este grupo',
    emptyCompleted: 'No hay tareas completadas en este grupo',
    emptyAll: 'No hay tareas en este grupo',
  },
  groups: {
    gridTitle: 'Mis Grupos',
    createGroupButton: 'Nuevo grupo',
    searchPlaceholder: 'Buscar tareas por título...',
    filterGroupLabel: 'Filtrar por grupo',
    allGroupsOption: 'Todos los grupos',
    refreshButton: 'Refrescar',
    refreshTooltip: 'Actualizar grupos y tareas',
    addTaskToGroup: 'Nueva tarea',
    personalBadge: 'Personal',
    groupMenuAria: 'Opciones del grupo',
    actionRename: 'Renombrar',
    actionDelete: 'Eliminar',
    createModalTitle: 'Crear nuevo grupo',
    renameModalTitle: 'Renombrar grupo',
    nameLabel: 'Nombre del grupo',
    namePlaceholder: 'Ej. Universidad, Proyecto, Trabajo',
    deleteModalTitle: 'Eliminar grupo',
    deleteModalWarning: (groupName: string) =>
      `¿Estás seguro de que deseas eliminar el grupo "${groupName}"? Todas sus tareas y etiquetas se eliminarán de forma permanente. Esta acción no se puede deshacer.`,
    cannotDeletePersonal: 'El grupo Personal no se puede eliminar.',
    emptyGroupTasks: 'No hay tareas que coincidan con los filtros en este grupo.',
    emptySearchGlobal: 'No se encontraron tareas con el título especificado.',
    noGroupsFound: 'No se encontraron grupos.',
    taskCount: (count: number) => `${count} ${count === 1 ? 'tarea' : 'tareas'}`,
  },
  tags: tagsLocalization,
} as const satisfies LocalizationDictionary;
