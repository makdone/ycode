import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';

/**
 * Preview layout — injects global custom body code.
 * Global head code is handled by the root layout for all routes.
 */
export default async function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettingsByKeys(['custom_code_body']);
  const globalCustomCodeBody = settings.custom_code_body as string | null;

  return (
    <>
      {children}
      {globalCustomCodeBody && (
        <div dangerouslySetInnerHTML={{ __html: globalCustomCodeBody }} />
      )}
    </>
  );
}
