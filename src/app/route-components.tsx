import { useEffect } from 'react';
import { Outlet, useRouter } from '@tanstack/react-router';
import {
  LoginPage,
  ProfilePage,
  RecoverPasswordPage,
  RegisterPage,
} from '../features/auth/components';
import { subscribeAuthSessionEnd } from '../features/auth/store';
import { GroupsGridView } from '../features/groups/components';

export function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    return subscribeAuthSessionEnd(() => {
      void router.navigate({ to: '/login', replace: true });
    });
  }, [router]);

  return <Outlet />;
}

export function WorkspaceRouteComponent() {
  const router = useRouter();
  return (
    <GroupsGridView
      onNavigateToProfile={() => {
        void router.navigate({ to: '/profile' });
      }}
      onLoggedOut={() => {
        void router.navigate({ to: '/login', replace: true });
      }}
    />
  );
}

export function ProfileRouteComponent() {
  const router = useRouter();
  return (
    <ProfilePage
      onBackToWorkspace={() => {
        void router.navigate({ to: '/' });
      }}
      onLoggedOut={() => {
        void router.navigate({ to: '/login', replace: true });
      }}
      onAccountDeleted={() => {
        void router.navigate({ to: '/login', replace: true });
      }}
    />
  );
}

export function LoginRouteComponent() {
  const router = useRouter();
  return (
    <LoginPage
      onSuccess={() => {
        void router.navigate({ to: '/', replace: true });
      }}
      onNavigateToRegister={() => {
        void router.navigate({ to: '/register' });
      }}
      onNavigateToRecover={() => {
        void router.navigate({ to: '/recover' });
      }}
    />
  );
}

export function RegisterRouteComponent() {
  const router = useRouter();
  return (
    <RegisterPage
      onContinueToApp={() => {
        void router.navigate({ to: '/', replace: true });
      }}
      onNavigateToLogin={() => {
        void router.navigate({ to: '/login' });
      }}
    />
  );
}

export function RecoverRouteComponent() {
  const router = useRouter();
  return (
    <RecoverPasswordPage
      onSuccess={() => {
        void router.navigate({ to: '/login', replace: true });
      }}
      onNavigateToLogin={() => {
        void router.navigate({ to: '/login' });
      }}
    />
  );
}

export function CatchAllRouteComponent() {
  return null;
}
