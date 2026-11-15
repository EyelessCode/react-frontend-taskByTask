import { describe, it, expect } from 'vitest';
import { es, type LocalizationDictionary } from '@/shared/i18n';

describe('Spanish Localization Dictionary (i18n/es.ts)', () => {
  it('should satisfy LocalizationDictionary interface contract', () => {
    const dict: LocalizationDictionary = es;
    expect(dict).toBeDefined();
    expect(dict.app).toBeDefined();
    expect(dict.common).toBeDefined();
    expect(dict.validation).toBeDefined();
    expect(dict.errors).toBeDefined();
    expect(dict.dateTime).toBeDefined();
    expect(dict.tasks).toBeDefined();
    expect(dict.groups).toBeDefined();
    expect(dict.tags).toBeDefined();
    expect(dict.auth).toBeDefined();
  });

  describe('app namespace', () => {
    it('should have app title and tagline in Spanish', () => {
      expect(es.app.title).toBe('Task by Task');
      expect(es.app.tagline).toBe('Gestiona tus tareas por grupos y etiquetas');
    });
  });

  describe('common namespace', () => {
    it('should have standard action button labels in Spanish', () => {
      expect(es.common.save).toBe('Guardar');
      expect(es.common.cancel).toBe('Cancelar');
      expect(es.common.delete).toBe('Eliminar');
      expect(es.common.confirm).toBe('Confirmar');
      expect(es.common.back).toBe('Volver');
      expect(es.common.close).toBe('Cerrar');
      expect(es.common.loading).toBe('Cargando...');
    });
  });

  describe('validation namespace', () => {
    it('should interpolate required field messages correctly', () => {
      const msg = es.validation.required('Título');
      expect(msg).toBe('El campo Título es obligatorio');
    });

    it('should interpolate minLength and maxLength messages correctly', () => {
      expect(es.validation.minLength('Nombre de usuario', 3)).toBe(
        'Nombre de usuario debe tener al menos 3 caracteres',
      );
      expect(es.validation.maxLength('Descripción', 750)).toBe(
        'Descripción no puede exceder 750 caracteres',
      );
    });

    it('should contain specific format validation messages in Spanish', () => {
      expect(es.validation.invalidEmail).toBe('El correo electrónico no tiene un formato válido');
      expect(es.validation.invalidUsername).toBe(
        'El nombre de usuario solo puede contener letras y números',
      );
    });

    it('should interpolate forbidden characters message', () => {
      const msg = es.validation.invalidCharacters('; o ,');
      expect(msg).toBe('No se permiten los siguientes caracteres: ; o ,');
    });

    it('should interpolate unique constraint messages', () => {
      const msg = es.validation.uniqueConstraint('nombre de etiqueta');
      expect(msg).toBe('Ya existe un registro con este nombre de etiqueta');
    });
  });

  describe('errors namespace', () => {
    it('should format notFound message with entity name', () => {
      expect(es.errors.notFound('Tarea')).toBe('Tarea no encontrado/a');
    });

    it('should format businessRule message with rule description', () => {
      expect(es.errors.businessRule('no se puede eliminar el grupo Personal')).toBe(
        'Acción no permitida: no se puede eliminar el grupo Personal',
      );
    });

    it('should contain system error messages in Spanish', () => {
      expect(es.errors.corruptedData).toBe(
        'Los datos almacenados están dañados o tienen un formato no válido',
      );
      expect(es.errors.storageQuota).toBe('El almacenamiento del navegador está lleno');
      expect(es.errors.unexpected).toBe(
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
      );
    });
  });

  describe('dateTime namespace', () => {
    it('should format date and time indicators strictly per requirements', () => {
      expect(es.dateTime.overdue).toBe('Vencida');
      expect(es.dateTime.today).toBe('Hoy');
      expect(es.dateTime.tomorrow).toBe('Mañana');
      expect(es.dateTime.dateFormat).toBe('dd/mm/aaaa');
    });
  });

  describe('tasks namespace', () => {
    it('should contain all required task localization keys in Spanish', () => {
      expect(es.tasks).toBeDefined();
      expect(es.tasks.createTitle).toBe('Nueva tarea');
      expect(es.tasks.editTitle).toBe('Editar tarea');
      expect(es.tasks.titleLabel).toBe('Título');
      expect(es.tasks.titlePlaceholder).toBe('Escribe el título de la tarea');
      expect(es.tasks.descLabel).toBe('Descripción');
      expect(es.tasks.descPlaceholder).toBe('Añade una descripción (opcional)');
      expect(es.tasks.dueDateLabel).toBe('Fecha de caducidad');
      expect(es.tasks.dueTimeLabel).toBe('Hora de caducidad');
      expect(es.tasks.tagsLabel).toBe('Etiquetas');
      expect(es.tasks.tagsPlaceholder).toBe('Escribe una etiqueta y presiona coma o punto y coma');
      expect(es.tasks.groupLabel).toBe('Grupo');
      expect(es.tasks.filterPending).toBe('Pendientes');
      expect(es.tasks.filterCompleted).toBe('Completadas');
      expect(es.tasks.filterAll).toBe('Todas');
      expect(es.tasks.actionMenuAria).toBe('Opciones de la tarea');
      expect(es.tasks.actionEdit).toBe('Editar');
      expect(es.tasks.actionMove).toBe('Mover a…');
      expect(es.tasks.actionCopy).toBe('Copiar a…');
      expect(es.tasks.actionDelete).toBe('Eliminar');
      expect(es.tasks.deleteTitle).toBe('Eliminar tarea');
      expect(es.tasks.deleteMessage).toBe(
        '¿Estás seguro de que deseas eliminar esta tarea? Esta acción no se puede deshacer.',
      );
      expect(es.tasks.confirmDelete).toBe('Eliminar');
      expect(es.tasks.cancelDelete).toBe('Cancelar');
      expect(es.tasks.moveTitle).toBe('Mover tarea');
      expect(es.tasks.copyTitle).toBe('Copiar tarea');
      expect(es.tasks.selectGroupLabel).toBe('Seleccionar grupo destino');
      expect(es.tasks.noOtherGroups).toBe(
        'No tienes otros grupos individuales disponibles para mover o copiar esta tarea.',
      );
      expect(es.tasks.confirmMove).toBe('Mover');
      expect(es.tasks.confirmCopy).toBe('Copiar');
      expect(es.tasks.removeTagTitle).toBe('Quitar etiqueta');
      expect(es.tasks.removeOnlyFromTask).toBe('Solo de la tarea');
      expect(es.tasks.removeFromGroup).toBe('Del grupo');
      expect(es.tasks.badgeOverdue).toBe('Vencida');
      expect(es.tasks.emptyPending).toBe('No hay tareas pendientes en este grupo');
      expect(es.tasks.emptyCompleted).toBe('No hay tareas completadas en este grupo');
      expect(es.tasks.emptyAll).toBe('No hay tareas en este grupo');
    });

    it('should format tag overflow indicator correctly', () => {
      expect(es.tasks.tagOverflow(3)).toBe('+3 más');
      expect(es.tasks.tagOverflow(1)).toBe('+1 más');
    });

    it('should format remove tag prompt message with tag name', () => {
      expect(es.tasks.removeTagPrompt('trabajo')).toBe(
        '¿Cómo deseas quitar la etiqueta "trabajo"?',
      );
    });

    it('should provide tag accessibility, inline editing, and UI-06 consequence strings', () => {
      expect(es.tasks.tagOverflowAria(2)).toBe(
        '2 etiquetas adicionales ocultas. Edita la tarea para ver todas.',
      );
      expect(es.tasks.editTagAria('trabajo')).toBe('Editar etiqueta trabajo');
      expect(es.tasks.editingTagInputAria('trabajo')).toBe('Editando etiqueta trabajo');
      expect(es.tasks.editTagHint).toBe(
        'Haz clic o presiona Enter en una etiqueta para editarla en esta tarea',
      );
      expect(es.tasks.removeTagAria('trabajo')).toBe('Quitar etiqueta trabajo');
      expect(es.tasks.removeTagDescription).toBe(
        'Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo. Si eliges "Del grupo", se eliminará permanentemente del grupo y de todas sus tareas.',
      );
    });
  });

  describe('tags namespace', () => {
    it('should expose the complete tag localization contract', () => {
      expect(es.tags.tagsLabel).toBe('Etiquetas');
      expect(es.tags.tagsPlaceholder).toBe('Escribe una etiqueta y presiona coma o punto y coma');
      expect(es.tags.tagOverflow(3)).toBe('+3 más');
      expect(es.tags.tagOverflowAria(3)).toBe(
        '3 etiquetas adicionales ocultas. Edita la tarea para ver todas.',
      );
      expect(es.tags.editTagAria('urgente')).toBe('Editar etiqueta urgente');
      expect(es.tags.editingTagInputAria('urgente')).toBe('Editando etiqueta urgente');
      expect(es.tags.editTagHint).toBe(
        'Haz clic o presiona Enter en una etiqueta para editarla en esta tarea',
      );
      expect(es.tags.removeTagAria('urgente')).toBe('Quitar etiqueta urgente');
      expect(es.tags.removeTagTitle).toBe('Quitar etiqueta');
      expect(es.tags.removeTagPrompt('urgente')).toBe(
        '¿Cómo deseas quitar la etiqueta "urgente"?',
      );
      expect(es.tags.removeTagDescription).toBe(
        'Si eliges "Solo de la tarea", la etiqueta se conservará en el grupo. Si eliges "Del grupo", se eliminará permanentemente del grupo y de todas sus tareas.',
      );
      expect(es.tags.removeOnlyFromTask).toBe('Solo de la tarea');
      expect(es.tags.removeFromGroup).toBe('Del grupo');
    });
  });

  describe('groups namespace', () => {
    it('should contain all required groups localization keys in Spanish', () => {
      expect(es.groups).toBeDefined();
      expect(es.groups.gridTitle).toBe('Mis Grupos');
      expect(es.groups.createGroupButton).toBe('Nuevo grupo');
      expect(es.groups.searchPlaceholder).toBe('Buscar tareas por título...');
      expect(es.groups.filterGroupLabel).toBe('Filtrar por grupo');
      expect(es.groups.allGroupsOption).toBe('Todos los grupos');
      expect(es.groups.refreshButton).toBe('Refrescar');
      expect(es.groups.refreshTooltip).toBe('Actualizar grupos y tareas');
      expect(es.groups.addTaskToGroup).toBe('Nueva tarea');
      expect(es.groups.personalBadge).toBe('Personal');
      expect(es.groups.groupMenuAria).toBe('Opciones del grupo');
      expect(es.groups.actionRename).toBe('Renombrar');
      expect(es.groups.actionDelete).toBe('Eliminar');
      expect(es.groups.createModalTitle).toBe('Crear nuevo grupo');
      expect(es.groups.renameModalTitle).toBe('Renombrar grupo');
      expect(es.groups.nameLabel).toBe('Nombre del grupo');
      expect(es.groups.namePlaceholder).toBe('Ej. Universidad, Proyecto, Trabajo');
      expect(es.groups.deleteModalTitle).toBe('Eliminar grupo');
      expect(es.groups.cannotDeletePersonal).toBe('El grupo Personal no se puede eliminar.');
      expect(es.groups.emptyGroupTasks).toBe(
        'No hay tareas que coincidan con los filtros en este grupo.',
      );
      expect(es.groups.emptySearchGlobal).toBe(
        'No se encontraron tareas con el título especificado.',
      );
      expect(es.groups.noGroupsFound).toBe('No se encontraron grupos.');
    });

    it('should format delete modal warning with group name', () => {
      expect(es.groups.deleteModalWarning('Trabajo')).toBe(
        '¿Estás seguro de que deseas eliminar el grupo "Trabajo"? Todas sus tareas y etiquetas se eliminarán de forma permanente. Esta acción no se puede deshacer.',
      );
    });

    it('should format taskCount function with singular and plural count', () => {
      expect(es.groups.taskCount(0)).toBe('0 tareas');
      expect(es.groups.taskCount(1)).toBe('1 tarea');
      expect(es.groups.taskCount(5)).toBe('5 tareas');
    });
  });

  describe('auth namespace', () => {
    it('should contain all required auth, recovery, profile, deletion, and 12h capture keys in Spanish', () => {
      expect(es.auth.profileLink).toBe('Mi perfil');
      expect(es.auth.logoutButton).toBe('Cerrar sesión');
      expect(es.auth.backToWorkspace).toBe('Volver a mis grupos');
      expect(es.auth.greetingPrefix).toBe('Hola,');

      expect(es.auth.loginTitle).toBe('Iniciar sesión');
      expect(es.auth.loginSubtitle).toBe('Accede a tus grupos y tareas');
      expect(es.auth.emailLabel).toBe('Correo electrónico');
      expect(es.auth.emailPlaceholder).toBe('tu@correo.com');
      expect(es.auth.emailRequired).toBe('El correo electrónico es obligatorio.');
      expect(es.auth.passwordLabel).toBe('Contraseña');
      expect(es.auth.passwordPlaceholder).toBe('Ingresa tu contraseña');
      expect(es.auth.passwordRequiredOnLogin).toBe('Ingresa tu contraseña.');
      expect(es.auth.loginButton).toBe('Entrar');
      expect(es.auth.invalidCredentials).toBe('Correo electrónico o contraseña incorrectos.');
      expect(es.auth.tooManyAttemptsMinutes(5)).toBe(
        'Demasiados intentos fallidos. Espera 5 min antes de intentar de nuevo.',
      );
      expect(es.auth.tooManyAttemptsSeconds(45)).toBe(
        'Demasiados intentos fallidos. Espera 45 s antes de intentar de nuevo.',
      );
      expect(es.auth.sessionExpired).toBe(
        'Tu sesión ha expirado. Inicia sesión nuevamente.',
      );
      expect(es.auth.goToRegister).toBe('¿No tienes cuenta? Regístrate');
      expect(es.auth.goToRecover).toBe('¿Olvidaste tu contraseña?');

      expect(es.auth.registerTitle).toBe('Crear cuenta');
      expect(es.auth.registerSubtitle).toBe('Comienza a organizar tus tareas por grupos');
      expect(es.auth.usernameLabel).toBe('Nombre de usuario');
      expect(es.auth.usernamePlaceholder).toBe('Ej. usuario123 (solo letras y números)');
      expect(es.auth.displayNameLabel).toBe('Nombre para mostrar');
      expect(es.auth.displayNamePlaceholder).toBe('Ej. Ana García');
      expect(es.auth.registerButton).toBe('Registrarse');
      expect(es.auth.goToLogin).toBe('¿Ya tienes cuenta? Inicia sesión');
      expect(es.auth.emailAlreadyExists).toBe(
        'Ya existe un registro con este correo electrónico',
      );
      expect(es.auth.usernameAlreadyExists).toBe(
        'Ya existe un registro con este nombre de usuario',
      );
      expect(es.auth.recoveryCodesTitle).toBe('Guarda tus códigos de recuperación');
      expect(es.auth.recoveryCodesWarning).toBe(
        'Estos 8 códigos se muestran una sola vez y son de un solo uso. Guárdalos en un lugar seguro; si los pierdes y olvidas tu contraseña, no podrás recuperar el acceso a tu cuenta.',
      );
      expect(es.auth.copyRecoveryCodes).toBe('Copiar códigos');
      expect(es.auth.copiedRecoveryCodes).toBe('Códigos copiados');
      expect(es.auth.continueToApp).toBe('He guardado mis códigos, continuar');

      expect(es.auth.recoverTitle).toBe('Recuperar contraseña');
      expect(es.auth.recoverSubtitle).toBe(
        'Usa uno de tus códigos de recuperación de un solo uso',
      );
      expect(es.auth.recoveryCodeLabel).toBe('Código de recuperación');
      expect(es.auth.recoveryCodePlaceholder).toBe('Código de 8 caracteres');
      expect(es.auth.recoveryCodeRequired).toBe('Ingresa un código de recuperación.');
      expect(es.auth.recoveryCodeLengthError).toBe(
        'El código de recuperación debe tener exactamente 8 caracteres.',
      );
      expect(es.auth.recoveryCodeFormatError).toBe(
        'El código de recuperación solo puede contener letras y números.',
      );
      expect(es.auth.newPasswordLabel).toBe('Nueva contraseña');
      expect(es.auth.recoverButton).toBe('Restablecer contraseña');
      expect(es.auth.invalidRecoveryRequest).toBe(
        'El correo o el código de recuperación no es válido o ya fue utilizado.',
      );
      expect(es.auth.recoverSuccess).toBe(
        'Tu contraseña ha sido restablecida. Ya puedes iniciar sesión.',
      );
      expect(es.auth.recoverLimitationNote).toBe(
        'Cada código es de un solo uso. Si agotaste o perdiste todos tus códigos, no es posible recuperar la cuenta en esta versión.',
      );

      expect(es.auth.profileTitle).toBe('Perfil y preferencias');
      expect(es.auth.profileSectionTitle).toBe('Datos de la cuenta');
      expect(es.auth.timeFormatLabel).toBe('Formato de hora');
      expect(es.auth.timeFormat24h).toBe('24 horas (ej. 14:30)');
      expect(es.auth.timeFormat12h).toBe('12 horas (ej. 02:30 p. m.)');
      expect(es.auth.timeZoneLabel).toBe('Zona horaria detectada');
      expect(es.auth.timeZoneHint).toBe('Se actualiza automáticamente al iniciar sesión.');
      expect(es.auth.saveProfileButton).toBe('Guardar cambios');
      expect(es.auth.profileSaved).toBe('Perfil y preferencias actualizados.');
      expect(es.auth.passwordSectionTitle).toBe('Cambiar contraseña');
      expect(es.auth.currentPasswordLabel).toBe('Contraseña actual');
      expect(es.auth.currentPasswordRequired).toBe('Ingresa tu contraseña actual.');
      expect(es.auth.invalidCurrentPassword).toBe('La contraseña actual es incorrecta.');
      expect(es.auth.changePasswordButton).toBe('Actualizar contraseña');
      expect(es.auth.passwordChanged).toBe('Contraseña actualizada correctamente.');
      expect(es.auth.regenerateSectionTitle).toBe('Códigos de recuperación');
      expect(es.auth.regenerateDescription).toBe(
        'Regenerar tus códigos invalida todos los códigos anteriores y genera 8 nuevos códigos mostrados una sola vez.',
      );
      expect(es.auth.regenerateButton).toBe('Regenerar códigos');
      expect(es.auth.regeneratedCodesTitle).toBe('Nuevos códigos de recuperación');

      expect(es.auth.dangerZoneTitle).toBe('Eliminar cuenta');
      expect(es.auth.deleteAccountButton).toBe('Eliminar mi cuenta');
      expect(es.auth.deleteAccountModalTitle).toBe('Eliminar cuenta permanentemente');
      expect(es.auth.deleteAccountWarning).toBe(
        'Esta acción es irreversible. Se eliminarán de forma permanente tu cuenta, todos tus grupos, tareas, etiquetas, códigos de recuperación y notificaciones.',
      );
      expect(es.auth.deleteAccountConfirmButton).toBe('Eliminar cuenta definitivamente');
      expect(es.auth.accountDeleted).toBe('Tu cuenta y todos tus datos han sido eliminados.');

      expect(es.auth.timeHourAria).toBe('Hora (12 horas)');
      expect(es.auth.timeMinuteAria).toBe('Minutos');
      expect(es.auth.timePeriodAria).toBe('Periodo (AM/PM)');
      expect(es.auth.clearTimeLabel).toBe('Limpiar hora');
      expect(es.auth.incompleteTimeError).toBe(
        'Completa la hora, los minutos y el periodo (AM/PM), o limpia la hora.',
      );
    });
  });
});
