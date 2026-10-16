// Plates need 1 ingot instead of 2 (hammer on top, ingot below).
// Collapses duplicate pattern rows of hammer-based #forge:plates crafting recipes: h/I/I -> h/I.
ServerEvents.recipes(event => {
  const JsonParser = Java.loadClass('com.google.gson.JsonParser');
  let changed = 0;

  event.forEachRecipe({ type: 'minecraft:crafting_shaped', output: '#forge:plates' }, recipe => {
    const json = recipe.json;
    if (!String(json.get('key')).includes('tools/crafting_hammers')) return;

    const rows = JSON.parse(String(json.get('pattern')));
    const unique = rows.filter((row, i) => rows.indexOf(row) === i);
    if (unique.length === rows.length) return;

    json.add('pattern', JsonParser.parseString(JSON.stringify(unique)));
    recipe.save();
    changed++;
  });

  console.info('[friendly_hand_crafting] rewrote ' + changed + ' plate recipes');
});
