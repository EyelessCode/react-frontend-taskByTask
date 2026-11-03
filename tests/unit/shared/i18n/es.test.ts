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
});
