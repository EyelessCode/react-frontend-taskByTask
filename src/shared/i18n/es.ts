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
}

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
} as const satisfies LocalizationDictionary;
