import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '../components/app-layout'
import NotFoundPage from '../pages/not-found-page'
import RouteErrorPage from '../pages/route-error-page'
import { ArticleRoute, ExploreRoute, HomeRoute } from './route-elements'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomeRoute /> },
      { path: 'explore', element: <ExploreRoute /> },
      { path: 'articles/:articleId', element: <ArticleRoute /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
