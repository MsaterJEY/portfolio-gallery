// Dates are set by the server. Reordering alone does not change updatedAt.
export function stampProjects(incoming, previous = [], now = Date.now()) {
  const fields = [
    'title', 'category', 'description', 'year', 'status',
    'url', 'cover', 'art', 'visible', 'featured'
  ];

  const oldById = new Map(
    previous.map(project => [project.id, project])
  );

  const validDate = value =>
    Number.isSafeInteger(value) && value > 0 ? value : null;

  return incoming.map(project => {
    const old = oldById.get(project.id);

    if (!old) {
      return {...project, createdAt: now, updatedAt: now};
    }

    const changed = fields.some(
      field => project[field] !== old[field]
    );

    return {
      ...project,
      createdAt: validDate(old.createdAt),
      updatedAt: changed ? now : validDate(old.updatedAt)
    };
  });
}
