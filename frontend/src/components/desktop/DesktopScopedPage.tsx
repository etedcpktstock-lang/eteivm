import React from 'react';

interface DesktopScopedPageProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  scopeClassName?: string;
}

const DesktopScopedPage: React.FC<DesktopScopedPageProps> = ({
  title,
  subtitle,
  children,
  scopeClassName = 'plain-scope',
}) => {
  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">{title}</h2>
          <p className="plain-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className={`plain-page-frame ${scopeClassName}`.trim()}>{children}</div>
    </div>
  );
};

export default DesktopScopedPage;
