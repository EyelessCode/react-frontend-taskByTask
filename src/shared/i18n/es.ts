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
  auth: AuthLocalization;
  notifications: NotificationsLocalization;
}

export interface NotificationsLocalization {
  centerButtonLabel: string;
  centerButtonAria: (count: number) => string;
  centerTitle: string;
  emptyState: string;
  unreadBadge: string;
  markAsReadButton: string;
  markAsReadAria: string;
  markAllAsReadButton: string;
  markAllAsReadAria: string;
  deleteButton: string;
  deleteAria: string;
  closeCenterAria: string;
  permissionPromptTitle: string;
  permissionPromptBody: string;
  enableNotificationsButton: string;
  dismissReminderButton: string;
  permissionDefaultStatus: string;
  permissionDeniedStatus: string;
  permissionBlockedTitle: string;
  permissionBlockedInstructions: string;
  permissionGrantedStatus: string;
  permissionUnsupportedNote: string;
  dueAlertTitle: string;
  dueAlertWithTime: (title: string, date: string, time: string) => string;
  dueAlertDateOnly: (title: string, date: string) => string;
}

export interface AuthLocalization {
  profileLink: string;
  logoutButton: string;
  backToWorkspace: string;
  greetingPrefix: string;
  loginTitle: string;
  loginSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailRequired: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordRequiredOnLogin: string;
  loginButton: string;
  invalidCredentials: string;
  tooManyAttemptsMinutes: (minutes: number) => string;
  tooManyAttemptsSeconds: (seconds: number) => string;
  sessionExpired: string;
  goToRegister: string;
  goToRecover: string;
  registerTitle: string;
  registerSubtitle: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  displayNameLabel: string;
  displayNamePlaceholder: string;
  registerButton: string;
  goToLogin: string;
  emailAlreadyExists: string;
  usernameAlreadyExists: string;
  recoveryCodesTitle: string;
  recoveryCodesWarning: string;
  copyRecoveryCodes: string;
  copiedRecoveryCodes: string;
  continueToApp: string;
  recoverTitle: string;
  recoverSubtitle: string;
  recoveryCodeLabel: string;
  recoveryCodePlaceholder: string;
  recoveryCodeRequired: string;
  recoveryCodeLengthError: string;
  recoveryCodeFormatError: string;
  newPasswordLabel: string;
  recoverButton: string;
  invalidRecoveryRequest: string;
  recoverSuccess: string;
  recoverLimitationNote: string;
  profileTitle: string;
  profileSectionTitle: string;
  timeFormatLabel: string;
  timeFormat24h: string;
  timeFormat12h: string;
  timeZoneLabel: string;
  timeZoneHint: string;
  saveProfileButton: string;
  profileSaved: string;
  passwordSectionTitle: string;
  currentPasswordLabel: string;
  currentPasswordRequired: string;
  invalidCurrentPassword: string;
  changePasswordButton: string;
  passwordChanged: string;
  regenerateSectionTitle: string;
  regenerateDescription: string;
  regenerateButton: string;
  regeneratedCodesTitle: string;
  dangerZoneTitle: string;
  deleteAccountButton: string;
  deleteAccountModalTitle: string;
  deleteAccountWarning: string;
  deleteAccountConfirmButton: string;
  accountDeleted: string;
  timeHourAria: string;
  timeMinuteAria: string;
  timePeriodAria: string;
  clearTimeLabel: string;
  incompleteTimeError: string;
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
  auth: {
    profileLink: 'Mi perfil',
    logoutButton: 'Cerrar sesión',
    backToWorkspace: 'Volver a mis grupos',
    greetingPrefix: 'Hola,',
    loginTitle: 'Iniciar sesión',
    loginSubtitle: 'Accede a tus grupos y tareas',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tu@correo.com',
    emailRequired: 'El correo electrónico es obligatorio.',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Ingresa tu contraseña',
    passwordRequiredOnLogin: 'Ingresa tu contraseña.',
    loginButton: 'Entrar',
    invalidCredentials: 'Correo electrónico o contraseña incorrectos.',
    tooManyAttemptsMinutes: (minutes: number) =>
      `Demasiados intentos fallidos. Espera ${minutes} min antes de intentar de nuevo.`,
    tooManyAttemptsSeconds: (seconds: number) =>
      `Demasiados intentos fallidos. Espera ${seconds} s antes de intentar de nuevo.`,
    sessionExpired: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
    goToRegister: '¿No tienes cuenta? Regístrate',
    goToRecover: '¿Olvidaste tu contraseña?',
    registerTitle: 'Crear cuenta',
    registerSubtitle: 'Comienza a organizar tus tareas por grupos',
    usernameLabel: 'Nombre de usuario',
    usernamePlaceholder: 'Ej. usuario123 (solo letras y números)',
    displayNameLabel: 'Nombre para mostrar',
    displayNamePlaceholder: 'Ej. Ana García',
    registerButton: 'Registrarse',
    goToLogin: '¿Ya tienes cuenta? Inicia sesión',
    emailAlreadyExists: 'Ya existe un registro con este correo electrónico',
    usernameAlreadyExists: 'Ya existe un registro con este nombre de usuario',
    recoveryCodesTitle: 'Guarda tus códigos de recuperación',
    recoveryCodesWarning:
      'Estos 8 códigos se muestran una sola vez y son de un solo uso. Guárdalos en un lugar seguro; si los pierdes y olvidas tu contraseña, no podrás recuperar el acceso a tu cuenta.',
    copyRecoveryCodes: 'Copiar códigos',
    copiedRecoveryCodes: 'Códigos copiados',
    continueToApp: 'He guardado mis códigos, continuar',
    recoverTitle: 'Recuperar contraseña',
    recoverSubtitle: 'Usa uno de tus códigos de recuperación de un solo uso',
    recoveryCodeLabel: 'Código de recuperación',
    recoveryCodePlaceholder: 'Código de 8 caracteres',
    recoveryCodeRequired: 'Ingresa un código de recuperación.',
    recoveryCodeLengthError: 'El código de recuperación debe tener exactamente 8 caracteres.',
    recoveryCodeFormatError: 'El código de recuperación solo puede contener letras y números.',
    newPasswordLabel: 'Nueva contraseña',
    recoverButton: 'Restablecer contraseña',
    invalidRecoveryRequest: 'El correo o el código de recuperación no es válido o ya fue utilizado.',
    recoverSuccess: 'Tu contraseña ha sido restablecida. Ya puedes iniciar sesión.',
    recoverLimitationNote:
      'Cada código es de un solo uso. Si agotaste o perdiste todos tus códigos, no es posible recuperar la cuenta en esta versión.',
    profileTitle: 'Perfil y preferencias',
    profileSectionTitle: 'Datos de la cuenta',
    timeFormatLabel: 'Formato de hora',
    timeFormat24h: '24 horas (ej. 14:30)',
    timeFormat12h: '12 horas (ej. 02:30 p. m.)',
    timeZoneLabel: 'Zona horaria detectada',
    timeZoneHint: 'Se actualiza automáticamente al iniciar sesión.',
    saveProfileButton: 'Guardar cambios',
    profileSaved: 'Perfil y preferencias actualizados.',
    passwordSectionTitle: 'Cambiar contraseña',
    currentPasswordLabel: 'Contraseña actual',
    currentPasswordRequired: 'Ingresa tu contraseña actual.',
    invalidCurrentPassword: 'La contraseña actual es incorrecta.',
    changePasswordButton: 'Actualizar contraseña',
    passwordChanged: 'Contraseña actualizada correctamente.',
    regenerateSectionTitle: 'Códigos de recuperación',
    regenerateDescription:
      'Regenerar tus códigos invalida todos los códigos anteriores y genera 8 nuevos códigos mostrados una sola vez.',
    regenerateButton: 'Regenerar códigos',
    regeneratedCodesTitle: 'Nuevos códigos de recuperación',
    dangerZoneTitle: 'Eliminar cuenta',
    deleteAccountButton: 'Eliminar mi cuenta',
    deleteAccountModalTitle: 'Eliminar cuenta permanentemente',
    deleteAccountWarning:
      'Esta acción es irreversible. Se eliminarán de forma permanente tu cuenta, todos tus grupos, tareas, etiquetas, códigos de recuperación y notificaciones.',
    deleteAccountConfirmButton: 'Eliminar cuenta definitivamente',
    accountDeleted: 'Tu cuenta y todos tus datos han sido eliminados.',
    timeHourAria: 'Hora (12 horas)',
    timeMinuteAria: 'Minutos',
    timePeriodAria: 'Periodo (AM/PM)',
    clearTimeLabel: 'Limpiar hora',
    incompleteTimeError: 'Completa la hora, los minutos y el periodo (AM/PM), o limpia la hora.',
  },
  notifications: {
    centerButtonLabel: 'Notificaciones',
    centerButtonAria: (count: number) => `Abrir centro de notificaciones (${count} sin leer)`,
    centerTitle: 'Centro de notificaciones',
    emptyState: 'No tienes notificaciones en este momento.',
    unreadBadge: 'Sin leer',
    markAsReadButton: 'Marcar como leída',
    markAsReadAria: 'Marcar notificación como leída',
    markAllAsReadButton: 'Marcar todas como leídas',
    markAllAsReadAria: 'Marcar todas las notificaciones como leídas',
    deleteButton: 'Eliminar',
    deleteAria: 'Eliminar notificación',
    closeCenterAria: 'Cerrar centro de notificaciones',
    permissionPromptTitle: 'Activa los avisos del navegador',
    permissionPromptBody:
      'Recibe alertas cuando tus tareas alcancen su fecha de caducidad, incluso si cambias de pestaña.',
    enableNotificationsButton: 'Activar avisos',
    dismissReminderButton: 'Ahora no',
    permissionDefaultStatus: 'Avisos del navegador pendientes de activar',
    permissionDeniedStatus: 'Avisos del navegador bloqueados',
    permissionBlockedTitle: 'Notificaciones bloqueadas en este navegador',
    permissionBlockedInstructions:
      'Has bloqueado los avisos para este sitio. Para reactivarlos, abre el ícono de candado o configuración junto a la barra de direcciones del navegador, cambia Notificaciones a "Permitir" y recarga la página.',
    permissionGrantedStatus: 'Avisos del navegador activados',
    permissionUnsupportedNote:
      'Este navegador no admite avisos emergentes; seguirás viendo todas tus alertas aquí.',
    dueAlertTitle: 'Aviso de vencimiento',
    dueAlertWithTime: (title: string, date: string, time: string) =>
      `La tarea "${title}" vence el ${date} a las ${time}.`,
    dueAlertDateOnly: (title: string, date: string) =>
      `La tarea "${title}" vence el ${date}.`,
  },
} as const satisfies LocalizationDictionary;
