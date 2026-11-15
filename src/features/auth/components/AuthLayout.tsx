import type { ReactNode } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import { es } from '../../../shared/i18n';

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Responsive Mobile-First shell for authentication and recovery views.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <Container className="py-4 py-md-5">
      <main>
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={7} lg={5}>
            <div className="text-center mb-4">
              <h1 className="h3 fw-bold text-primary mb-1">{es.app.title}</h1>
              <p className="text-muted small mb-0">{es.app.tagline}</p>
            </div>

            <Card className="shadow-sm border-0">
              <Card.Body className="p-4">
                <h2 className="h5 fw-semibold mb-1">{title}</h2>
                {subtitle && <p className="text-muted small mb-3">{subtitle}</p>}
                {children}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </main>
    </Container>
  );
}
