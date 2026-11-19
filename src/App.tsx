import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './app/router';

const appRouter = createAppRouter();

export function App() {
  return <RouterProvider router={appRouter} />;
}

export default App;
