import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { useAuthStore } from '../features/auth/store';
import {
  CatchAllRouteComponent,
  LoginRouteComponent,
  ProfileRouteComponent,
  RecoverRouteComponent,
  RegisterRouteComponent,
  RootLayout,
  WorkspaceRouteComponent,
} from './route-components';

function exitPendingRecoveryCodesIfAny(): void {
  if (useAuthStore.getState().postRegisterCodesPending) {
    useAuthStore.getState().acknowledgeRegistrationCodes();
  }
}

async function requireAuthenticatedGuard(): Promise<void> {
  const { authenticated } = await useAuthStore.getState().validateSession();
  if (!authenticated) {
    throw redirect({ to: '/login', replace: true });
  }
  exitPendingRecoveryCodesIfAny();
}

async function requireUnauthenticatedGuard(): Promise<void> {
  const { authenticated } = await useAuthStore.getState().validateSession();
  if (authenticated) {
    exitPendingRecoveryCodesIfAny();
    throw redirect({ to: '/', replace: true });
  }
}

async function registerRouteGuard(): Promise<void> {
  const { authenticated } = await useAuthStore.getState().validateSession();
  if (authenticated) {
    const { postRegisterCodesPending, oneTimeRecoveryCodes } = useAuthStore.getState();
    const hasPendingCodes =
      postRegisterCodesPending &&
      oneTimeRecoveryCodes !== null &&
      oneTimeRecoveryCodes.length > 0;
    if (!hasPendingCodes) {
      throw redirect({ to: '/', replace: true });
    }
  }
}

async function catchAllGuard(): Promise<void> {
  const { authenticated } = await useAuthStore.getState().validateSession();
  if (authenticated) {
    exitPendingRecoveryCodesIfAny();
    throw redirect({ to: '/', replace: true });
  }
  throw redirect({ to: '/login', replace: true });
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuthenticatedGuard,
  component: WorkspaceRouteComponent,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireAuthenticatedGuard,
  component: ProfileRouteComponent,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireUnauthenticatedGuard,
  component: LoginRouteComponent,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: registerRouteGuard,
  component: RegisterRouteComponent,
});

const recoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recover',
  beforeLoad: requireUnauthenticatedGuard,
  component: RecoverRouteComponent,
});

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  beforeLoad: catchAllGuard,
  component: CatchAllRouteComponent,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  profileRoute,
  loginRoute,
  registerRoute,
  recoverRoute,
  catchAllRoute,
]);

/**
 * Creates the application TanStack Router instance.
 * Accepts an optional history (e.g. `createMemoryHistory`) for integration testing.
 */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
