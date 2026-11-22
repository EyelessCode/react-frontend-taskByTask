import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { es } from '../../../shared/i18n';

export interface OneTimeRecoveryCodesCardProps {
  codes: string[];
  title?: string;
  warningMessage?: string;
  continueLabel?: string;
  onContinue: () => void;
}

/**
 * Displays 8 one-time single-use recovery codes with explicit save warning and copy action.
 */
export function OneTimeRecoveryCodesCard({
  codes,
  title,
  warningMessage,
  continueLabel = es.auth.continueToApp,
  onContinue,
}: OneTimeRecoveryCodesCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      {title && <h3 className="h6 fw-semibold mb-2">{title}</h3>}
      <Alert variant="warning" className="small">
        {warningMessage || es.auth.recoveryCodesWarning}
      </Alert>

      <Row xs={2} className="g-2 mb-3">
        {codes.map((code) => (
          <Col key={code}>
            <div className="p-2 bg-light border rounded text-center">
              <code className="fw-bold text-dark">{code}</code>
            </div>
          </Col>
        ))}
      </Row>

      <div className="d-grid gap-2">
        <Button variant="outline-secondary" size="sm" type="button" onClick={handleCopy}>
          {copied ? es.auth.copiedRecoveryCodes : es.auth.copyRecoveryCodes}
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
