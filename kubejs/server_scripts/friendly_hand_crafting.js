// Friendly hand-crafting ratios for GregTech Modern (KubeJS 6 / Forge 1.20.1).
//
// Shaped crafting recipes that use one repeated material (e.g. plates:
// hammer + 2 ingots -> 1 plate) are replaced with a version that needs only one
// copy of that material (hammer + 1 ingot -> 1 plate). Tools are kept as-is.
//
// Put this file in <instance>/kubejs/server_scripts/ and run /reload.

ServerEvents.recipes(event => {
  // Which recipe outputs get the friendlier ratio. Add more patterns as you like.
  // Tested against the output item id, e.g. "gtceu:iron_plate".
  const OUTPUT_FILTERS = [
    /_plate$/,        // plates
    // /_rod$/,       // uncomment to also adjust other hand-craft outputs
    // /_ring$/,
  ];

  const isTool = j => JSON.stringify(j).indexOf('tools/crafting_') !== -1;

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
    if (!OUTPUT_FILTERS.some(re => re.test(outId))) return;
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

    // Only handle: one repeated material (+ any number of tools).
    if (materials.length !== 1 || counts[materials[0]] <= 1) return;

    const row = tools.concat(materials).join('');
    if (row.length > 3) return;

    const keyMap = {};
    for (const sym of tools.concat(materials)) {
      const ing = toIngredient(key.get(sym));
      if (ing === null) return; // unknown ingredient format, leave recipe alone
      keyMap[sym] = ing;
    }

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
  });

  console.info('[friendly_hand_crafting] matched ' + seen + ', rewrote ' + jobs.length + ' recipes');
});
