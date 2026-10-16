// Friendly hand-crafting ratios for GregTech Modern (KubeJS 6 / Forge 1.20.1).
//
// Shaped crafting recipes that use one repeated material (e.g. plates:
// hammer + 2 ingots -> 1 plate) are replaced with a version that needs only one
// copy of that material (hammer + 1 ingot -> 1 plate). Tools are kept as-is.
//
// Put this file in <instance>/kubejs/server_scripts/ and run /reload.

ServerEvents.recipes(event => {
  // Optional: restrict to outputs whose item id matches one of these patterns,
  // e.g. [/_plate$/, /_rod$/]. Leave empty to cover every tool-based recipe.
  const OUTPUT_FILTERS = [];

  const isTool = j => String(j.toString()).indexOf('tools/crafting_') !== -1;

  // Turn a recipe-JSON ingredient into something event.shaped understands.
  const toIngredient = j => {
    if (j.has('item')) return String(j.get('item').getAsString());
    if (j.has('tag')) return '#' + String(j.get('tag').getAsString());
    return null;
  };

  const jobs = [];
  let seen = 0;

  event.forEachRecipe({ type: 'minecraft:crafting_shaped' }, recipe => {
    const json = recipe.json;
    if (!json.has('pattern') || !json.has('key') || !json.has('result')) return;

    const result = json.get('result');
    if (!result.has('item')) return;
    const outId = String(result.get('item').getAsString());
    if (OUTPUT_FILTERS.length > 0 && !OUTPUT_FILTERS.some(re => re.test(outId))) return;
    seen++;

    // Count how often each symbol appears in the grid.
    const counts = {};
    json.get('pattern').forEach(row => {
      String(row.getAsString()).split('').forEach(c => {
        if (c !== ' ') counts[c] = (counts[c] || 0) + 1;
      });
    });

    // Split symbols into tools and materials.
    const key = json.get('key');
    const tools = [];
    const materials = [];
    Object.keys(counts).forEach(sym => {
      if (!key.has(sym)) return;
      (isTool(key.get(sym)) ? tools : materials).push(sym);
    });

    // Only tool-based recipes (hammer, saw, file, ...) with one repeated material.
    // Tool-less ones such as ingot -> block compression are left alone.
    if (tools.length === 0 || materials.length !== 1 || counts[materials[0]] <= 1) return;

    const row = tools.concat(materials).join('');
    if (row.length > 3) return;

    // Rhino mishandles block-scoped const in loops, so use plain function scopes.
    const keyMap = {};
    let supported = true;
    tools.concat(materials).forEach(function (sym) {
      const converted = toIngredient(key.get(sym));
      if (converted === null) supported = false; // unknown format, leave recipe alone
      keyMap[sym] = converted;
    });
    if (!supported) return;

    jobs.push({
      id: String(recipe.getId()),
      out: outId,
      count: result.has('count') ? result.get('count').getAsInt() : 1,
      row: row,
      keyMap: keyMap,
    });
  });

  // Apply after iterating so we don't modify recipes mid-loop.
  jobs.forEach(job => {
    event.remove({ id: job.id });
    event.shaped(Item.of(job.out, job.count), [job.row], job.keyMap).id(job.id);
    console.info('[friendly_hand_crafting] ' + job.id + ' -> ' + job.row);
  });

  console.info('[friendly_hand_crafting] matched ' + seen + ', rewrote ' + jobs.length + ' recipes');
});
