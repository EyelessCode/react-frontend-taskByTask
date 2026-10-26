# Documento de Visión y Alcance

**Nombre del Proyecto:** Task by Task  
**Versión:** 1.0  
**Fecha:** 13/10/2026  
**Patrocinador / Cliente:** Proyecto personal de portafolio (sin patrocinador externo)  
**Líder de Producto / Proyecto:** Cristhian  

---

## Control de Versiones

| Versión | Fecha | Autor | Descripción del Cambio |
| :--- | :--- | :--- | :--- |
| 1.0 | 13/10/2026 | Cristhian | Versión inicial del documento de visión, resultado del análisis de requisitos. |

---

## Tabla de Contenidos

- [1. Oportunidad de Negocio y Justificación](#1-oportunidad-de-negocio-y-justificación)
  - [1.1 Contexto y Declaración del Problema](#11-contexto-y-declaración-del-problema)
  - [1.2 Oportunidad de Negocio](#12-oportunidad-de-negocio)
  - [1.3 Objetivos Estratégicos y Métricas de Éxito](#13-objetivos-estratégicos-y-métricas-de-éxito)
  - [1.4 Riesgos del Negocio](#14-riesgos-del-negocio)
- [2. Visión de la Solución](#2-visión-de-la-solución)
  - [2.1 Declaración de la Visión (Vision Statement)](#21-declaración-de-la-visión-vision-statement)
  - [2.2 Características Principales del Producto](#22-características-principales-del-producto)
  - [2.3 Suposiciones y Dependencias Clave](#23-suposiciones-y-dependencias-clave)
- [3. Alcance y Limitaciones](#3-alcance-y-limitaciones)
  - [3.1 Alcance de la Versión Inicial (Fase 1 / MVP)](#31-alcance-de-la-versión-inicial-fase-1--mvp)
  - [3.2 Alcance de Versiones Posteriores](#32-alcance-de-versiones-posteriores)
  - [3.3 Fuera de Alcance (Exclusiones Explícitas)](#33-fuera-de-alcance-exclusiones-explícitas)
- [4. Contexto de los Interesados (Stakeholders)](#4-contexto-de-los-interesados-stakeholders)
  - [4.1 Perfiles de los Interesados y Usuarios](#41-perfiles-de-los-interesados-y-usuarios)

---

## 1. Oportunidad de Negocio y Justificación

### 1.1 Contexto y Declaración del Problema

| Elemento | Detalle |
| :--- | :--- |
| **El problema de:** | Recordar tareas pendientes, recordatorios y mandados. Hoy se resuelve guardándolos en la cabeza, delegando el recordatorio a otra persona o anotándolos en hojas o archivos, donde eventualmente se pierden. |
| **Afecta a:** | Personas con muchas tareas de distinta naturaleza (estudio, programación, vida personal) y, en menor medida, a quienes necesitan coordinar esas tareas con otras personas. |
| **Cuyo impacto es:** | Olvidos, pérdida de anotaciones, poca visibilidad del trabajo pendiente y dependencia de otras personas para recordar. |
| **Una solución exitosa permitiría:** | Gestionar las tareas en un solo lugar, verlas organizadas por grupos y etiquetas, encontrarlas con filtros adecuados, recibir avisos cuando llegue su fecha y hora y, en versiones posteriores, compartir grupos de tareas con otras personas. |

### 1.2 Oportunidad de Negocio
- Task by Task es un **proyecto de portafolio**, gratuito y sin monetización. Su valor es demostrar un producto completo y funcional, desde el análisis hasta la implementación.
- Se inspira en Google Tasks. Su diferenciador previsto es poder **compartir un grupo de tareas con otras personas**, con roles que definen qué puede hacer cada una, y delegar tareas dentro del grupo. Esta capacidad se incorpora en versiones posteriores al MVP.

### 1.3 Objetivos Estratégicos y Métricas de Éxito
> No se definieron metas numéricas formales de negocio. Las métricas de adopción se obtendrán del Panel de métricas del Analista (versión posterior). Los valores de capacidad siguen los supuestos del SRS.

| ID | Objetivo de Negocio | Métrica de Éxito (KPI) | Meta Temporal |
| :--- | :--- | :--- | :--- |
| **OBJ-01** | Ofrecer un gestor de tareas funcional y fácil de usar | Todas las funciones del MVP (sección 3.1) operativas y verificadas contra el SRS | MVP |
| **OBJ-02** | Avisar oportunamente al usuario cuando llegue la fecha y hora de sus tareas | Aviso entregado en pocos minutos desde el momento programado, cuando el navegador lo permita | MVP |
| **OBJ-03** | Soportar una base de usuarios pequeña de portafolio | 1.000 usuarios registrados sin degradar el servicio | MVP |
| **OBJ-04** | Habilitar la colaboración en grupos | Grupos compartidos de hasta 5 personas con roles operativos | Versiones posteriores |
| **OBJ-05** | Conocer la adopción de la plataforma | Métricas de usuarios, tareas y grupos visibles para el Analista | Versiones posteriores |

### 1.4 Riesgos del Negocio
- **Riesgo 1:** Los avisos del navegador dependen del permiso del usuario y de cada sistema. No se garantizan con el dispositivo apagado ni, en iPhone, si el sitio no está instalado en la pantalla de inicio (soporte de "mejor esfuerzo"). Mitigación: todo aviso queda también en el centro de notificaciones y se informa al usuario cuando no ha concedido el permiso.
- **Riesgo 2:** Sin verificación de correo, alguien puede registrarse con un correo que no le pertenece. Es una limitación conocida del MVP.
- **Riesgo 3:** La recuperación de contraseña depende de códigos que el usuario debe guardar. Si los pierde, pierde el acceso a la cuenta.
- **Riesgo 4:** La visión (compartir tareas) queda fuera del MVP. Mitigación: el MVP debe diseñarse para incorporar los grupos compartidos sin rehacer lo existente.
- **Riesgo 5:** Sin actualización en tiempo real, dos personas podrían editar la misma tarea sin verse entre sí. Aplica desde que existan grupos compartidos. Mitigación: gana el último cambio y se muestran errores controlados.

---

## 2. Visión de la Solución

### 2.1 Declaración de la Visión (Vision Statement)

* **Para:** personas cansadas de recordar tareas, recordatorios y mandados.
* **Que:** necesitan organizar sus pendientes y ser avisadas cuando llegue su fecha y hora.
* **El:** Task by Task
* **Es una:** plataforma web (responsive, Mobile-First) de gestión de tareas.
* **Que ofrece:** gestión de tareas organizadas por grupos y etiquetas, mayor visibilidad del trabajo, filtrado adecuado para encontrarlas y avisos del navegador cuando llega su fecha y hora.
* **A diferencia de:** recordarlas de memoria, delegar el recordatorio a otra persona o anotarlas en hojas o archivos donde eventualmente se pierden.
* **Nuestro producto:** facilita la gestión y el aviso de tareas y, en versiones posteriores, permite compartir grupos de tareas (con sus etiquetas) con otras personas, con roles y delegación de tareas.

### 2.2 Características Principales del Producto

| ID | Característica | Descripción | Fase |
| :--- | :--- | :--- | :---: |
| **CP-01** | Cuenta y acceso | Registro, inicio de sesión con correo, perfil y preferencias, recuperación de contraseña con códigos y eliminación de cuenta. | MVP |
| **CP-02** | Gestión de tareas | Crear, editar, eliminar, completar y desmarcar tareas con fecha de caducidad opcional, indicador visual de vencida o completada, y mover o copiar entre grupos individuales. | MVP |
| **CP-03** | Grupos de tareas | Grupo "Personal" por defecto y grupos individuales propios para organizar las tareas. | MVP |
| **CP-04** | Etiquetas | Etiquetas por grupo, opcionales, que se escriben directamente en la tarea. | MVP |
| **CP-05** | Búsqueda y filtros | Filtro principal (pendientes por defecto, completadas, todas), por título y por grupo. | MVP |
| **CP-06** | Notificaciones | Aviso del navegador al llegar la fecha de caducidad, con centro de notificaciones dentro de la plataforma y zona horaria del usuario. | MVP |
| **CP-07** | Compartir grupos | Grupos compartidos de hasta 5 personas con roles (creador, gestor, visitante), invitaciones, asignación de tareas a una persona y mover o copiar hacia grupos compartidos. | Posterior |
| **CP-08** | Tareas avanzadas | Subtareas (lista de un nivel), recordatorios previos fijos y tareas que se repiten. | Posterior |
| **CP-09** | Filtros avanzados | Rango de fechas (por creación o por caducidad) y filtro por etiqueta. | Posterior |
| **CP-10** | Métricas | Panel de solo lectura para un rol "Analista" con métricas globales. | Posterior |

### 2.3 Suposiciones y Dependencias Clave
- **Suposiciones:**
  - Los usuarios dispondrán de un navegador moderno (Chrome, Edge o Firefox) y conexión a internet.
  - La plataforma estará únicamente en **español**, sin otras plataformas (sin aplicaciones nativas).
  - El producto es **gratuito**, sin planes de pago.
  - Cada grupo compartido tendrá un máximo de 5 personas (incluido el creador).
- **Dependencias:**
  - El mecanismo de notificaciones del navegador, cuyo comportamiento varía según el navegador y el sistema operativo.
  - En versiones posteriores, un servicio de envío de correo electrónico (invitaciones, verificación de correo y recuperación de contraseña).
  - La solución se mantiene **agnóstica a la tecnología**: no se fija lenguaje, base de datos ni proveedor.

---

## 3. Alcance y Limitaciones

### 3.1 Alcance de la Versión Inicial (Fase 1 / MVP)
> El MVP es un **gestor de tareas individual con varios grupos**. Donde se indica "básico", la funcionalidad es simple y funcional, sin detalles de pulido.

- **Cuenta (completo):** registro, inicio de sesión con correo y contraseña, cambio de datos, eliminación de cuenta, códigos de recuperación de contraseña, zona horaria y formato de hora (24 h por defecto, intercambiable con 12 h).
- **Tareas (básico):** título, descripción opcional, fecha de creación automática, fecha de caducidad opcional (con hora opcional) y estado completado. Las vencidas se muestran en rojo y las completadas, tachadas.
- **Grupos (básico):** solo **grupos individuales**. Cada usuario tiene el grupo "Personal" por defecto (se puede renombrar, no eliminar ni compartir) y puede crear los demás que quiera.
- **Mover y copiar (básico):** desde el menú de opciones de la tarea ("Mover a…" y "Copiar a…"), solo hacia grupos individuales.
- **Etiquetas (básico):** por grupo, se crean al escribirlas en la tarea, con sugerencias, y una ventana pregunta si se quitan solo de la tarea o también del grupo.
- **Filtros (básico):** filtro principal (pendientes, completadas, todas), búsqueda por título (sin distinguir mayúsculas) y por grupo (uno o varios), combinables.
- **Notificaciones (básico):** aviso del navegador al llegar la fecha de caducidad y centro de notificaciones dentro de la plataforma, con conservación de un mes. Las tareas con fecha pero sin hora avisan a las 9:00 hora local del usuario.
- **Eliminar grupo o cuenta (básico):** con advertencia previa. Se elimina todo su contenido.
- **Calidad del MVP:** diseño responsive Mobile-First, accesibilidad básica, y diseño preparado para incorporar después grupos compartidos, subtareas y recordatorios sin rehacer lo existente.

### 3.2 Alcance de Versiones Posteriores
> Ideas aprobadas, pero postergadas para aligerar el MVP. Se agrupan por tema, sin orden ni fechas comprometidas.

- **Colaboración:**
  - Grupos compartidos de 2 a 5 personas y roles (creador, gestor, visitante).
  - Invitaciones dentro de la plataforma, con caducidad de 24 horas.
  - Asignación de tareas a una persona.
  - Mover y copiar tareas hacia grupos compartidos.
  - Notificaciones asociadas (invitaciones, cambios de rol, asignaciones, miembros, expulsión, eliminación de grupo o cuenta).
  - Avisos a miembros al eliminar grupos o cuentas, incluido el detalle de tareas asignadas.
- **Tareas avanzadas:**
  - Subtareas (lista de un nivel, hasta 25 por tarea) con sincronización de estado.
  - Recordatorios previos fijos (15 min, 30 min, 1 h, 6 h y 1 día antes).
  - Tareas que se repiten. En pantalla solo se indicará "Se repetirá: [fecha]", sin mostrar el nombre de la propiedad.
- **Filtros avanzados:**
  - Rango de fechas (por creación o por caducidad).
  - Filtro por etiqueta (disponible con un solo grupo seleccionado).
- **Etiquetas:** pantalla de gestión de etiquetas por grupo.
- **Comunicación por correo electrónico:** invitar a personas sin cuenta, verificación de correo y recuperación de contraseña por correo.
- **Administración:** rol "Analista" con inicio de sesión aparte y Panel de métricas de solo lectura (usuarios registrados, tareas completadas y pendientes, grupos individuales y compartidos por separado).
- **Experiencia:** arrastrar y soltar tareas, actualización en tiempo real y búsqueda por descripción y subtareas.

### 3.3 Fuera de Alcance (Exclusiones Explícitas)
- **Prioridades de tareas:** descartadas.
- **Colores personalizados:** no previstos. Solo se usan los indicadores de vencida (rojo) y completada (tachada).
- **Otras plataformas:** aplicaciones nativas móviles o de escritorio.
- **Monetización:** planes de pago o límites comerciales.
- **Otros idiomas:** la plataforma es solo en español.
- **Grupos de más de 5 personas.**

---

## 4. Contexto de los Interesados (Stakeholders)

### 4.1 Perfiles de los Interesados y Usuarios

| Rol / Perfil | Interés Principal en el Proyecto | Restricciones o Preocupaciones |
| :--- | :--- | :--- |
| **Usuario (individual)** | Organizar sus tareas, encontrarlas con facilidad y recibir avisos a tiempo. | Facilidad de uso en celular y computador, privacidad de sus datos, no perder el acceso a su cuenta. |
| **Miembro de grupo compartido: Creador** *(posterior)* | Coordinar un grupo, invitar y expulsar personas, asignar roles. | Controlar quién ve y modifica las tareas del grupo. |
| **Miembro de grupo compartido: Gestor** *(posterior)* | Crear, modificar, eliminar y asignar tareas del grupo. | Permisos acotados a su rol. |
| **Miembro de grupo compartido: Visitante** *(posterior)* | Ver las tareas del grupo y completar las que le asignan. | No puede crear, editar ni eliminar tareas. |
| **Analista** *(posterior)* | Consultar métricas globales de la plataforma. | Solo lectura, sin acceso al contenido de las tareas. |
| **Autor / desarrollador** | Un producto de portafolio completo, mantenible y ampliable. | Alcance acotado por fases y diseño agnóstico a la tecnología. |
