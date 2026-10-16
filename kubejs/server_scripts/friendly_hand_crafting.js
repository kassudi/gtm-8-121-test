// Friendly hand-crafting ratios for GregTech Modern (KubeJS 6 / Forge 1.20.1).
//
// Shaped crafting recipes that use one repeated material (e.g. plates:
// hammer + 2 ingots -> 1 plate) are rewritten so a single copy of that
// material is enough (hammer + 1 ingot -> 1 plate). The recipe type, output
// and tool ingredients are untouched, so tool durability handling still works.
//
// Put this file in <instance>/kubejs/server_scripts/ and run /reload.

const JsonArray = Java.loadClass('com.google.gson.JsonArray');
const JsonPrimitive = Java.loadClass('com.google.gson.JsonPrimitive');

ServerEvents.recipes(event => {
  // Which recipe outputs get the friendlier ratio. Add more patterns as you like.
  // Tested against the output item id, e.g. "gtceu:iron_plate".
  const OUTPUT_FILTERS = [
    /_plate$/,        // plates
    // /_rod$/,       // uncomment to also adjust other hand-craft outputs
    // /_ring$/,
  ];

  const SHAPED_TYPES = ['minecraft:crafting_shaped', 'gtceu:shaped'];
  const isTool = ingredientJson => JSON.stringify(ingredientJson).indexOf('tools/crafting_') !== -1;

  let changed = 0;

  SHAPED_TYPES.forEach(type => {
    event.forEachRecipe({ type: type }, recipe => {
      const json = recipe.json;
      if (!json.has('pattern') || !json.has('key') || !json.has('result')) return;

      const result = json.get('result');
      const outId = result.has('item') ? String(result.get('item').getAsString()) : '';
      if (!OUTPUT_FILTERS.some(re => re.test(outId))) return;

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

      // New layout: a single row, tools first then one material.
      const newRow = tools.concat(materials).join('');
      if (newRow.length > 3) return;

      const pattern = new JsonArray();
      pattern.add(new JsonPrimitive(String(newRow)));
      json.add('pattern', pattern);
      recipe.save();
      changed++;
    });
  });

  console.info('[friendly_hand_crafting] reduced ' + changed + ' recipes');
});
