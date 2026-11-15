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
});
