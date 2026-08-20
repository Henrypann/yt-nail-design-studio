/** Pure legacy template deep-link migration; never carries draft-reset or canonical intent flags. */
export function buildOfficialTemplateRedirect(search: string, hash = ''): string {
  const params = new URLSearchParams(search);
  params.delete('fresh');
  params.delete('versionedIntent');
  params.set('officialTemplatePanel', '1');
  return `/studio/design/new?${params.toString()}${hash}`;
}
