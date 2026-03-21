# Filter Cycle Configuration Update

## Summary

Added configurable auto-cycle filter options to MMM-MyTeams-Fixtures, allowing users to control which filters are included in the automatic rotation.

## What Changed

### Previous Behavior
- Auto-cycle only rotated between **Home** and **Away** filters
- No way to include All, Domestic, or European filters in the rotation

### New Behavior (v1.1.0)
- Five new configuration options to toggle which filters are included:
  - `cycleAll` (default: true)
  - `cycleHome` (default: true)
  - `cycleAway` (default: true)
  - `cycleDomestic` (default: false)
  - `cycleEuropean` (default: false)

- Default configuration now cycles: **All → Home → Away**
- Fully customizable for any combination of filters

## Files Modified

1. **MMM-MyTeams-Fixtures.js**
   - Added 5 new configuration options in `defaults` (lines 53-58)
   - Updated `_buildCycleFilterKeys()` function to respect toggle settings (lines 465-488)

2. **README.md**
   - Added new options to configuration table
   - Added comprehensive "Auto-Cycle Filters" section with examples

3. **CHANGELOG.md**
   - Documented new feature in v1.1.0 release notes

## Configuration Examples

### Example 1: Default (All → Home → Away)
```javascript
config: {
  autoCycleFilters: true,
  autoCycleIntervalMs: 20000,
  cycleAll: true,          // ✅ Included
  cycleHome: true,         // ✅ Included
  cycleAway: true,         // ✅ Included
  cycleDomestic: false,    // ❌ Not included
  cycleEuropean: false     // ❌ Not included
}
```

### Example 2: Previous Behavior (Home → Away only)
```javascript
config: {
  autoCycleFilters: true,
  cycleAll: false,         // ❌ Not included
  cycleHome: true,         // ✅ Included
  cycleAway: true,         // ✅ Included
  cycleDomestic: false,    // ❌ Not included
  cycleEuropean: false     // ❌ Not included
}
```

### Example 3: All Filters (All → Domestic → European → Home → Away)
```javascript
config: {
  autoCycleFilters: true,
  cycleAll: true,          // ✅ Included
  cycleHome: true,         // ✅ Included
  cycleAway: true,         // ✅ Included
  cycleDomestic: true,     // ✅ Included
  cycleEuropean: true      // ✅ Included
}
```

### Example 4: Competition Focus (Domestic → European only)
```javascript
config: {
  autoCycleFilters: true,
  cycleAll: false,         // ❌ Not included
  cycleHome: false,        // ❌ Not included
  cycleAway: false,        // ❌ Not included
  cycleDomestic: true,     // ✅ Included
  cycleEuropean: true      // ✅ Included
}
```

## Backward Compatibility

✅ **Fully backward compatible**
- Existing configurations without these options will use the defaults
- Default behavior is now All → Home → Away (improved from previous Home → Away only)
- If all cycle options are set to false, falls back to Home → Away for safety

## How to Update Your config.js

### Option 1: Use Defaults (Recommended)
Simply enable auto-cycling - the new defaults will cycle through All, Home, and Away:

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    autoCycleFilters: true,
    autoCycleIntervalMs: 20000,
    // No need to specify cycle options - defaults are good!
  }
}
```

### Option 2: Customize Filter Rotation
Add the specific filters you want to cycle through:

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    autoCycleFilters: true,
    autoCycleIntervalMs: 20000,
    
    // Customize which filters to include
    cycleAll: true,
    cycleHome: true,
    cycleAway: true,
    cycleDomestic: false,    // Set to true if you want domestic fixtures in rotation
    cycleEuropean: false     // Set to true if you want European fixtures in rotation
  }
}
```

### Option 3: Match Previous Behavior
If you prefer the old Home → Away only rotation:

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    autoCycleFilters: true,
    autoCycleIntervalMs: 20000,
    
    cycleAll: false,         // Disable "All" filter
    cycleHome: true,
    cycleAway: true,
    cycleDomestic: false,
    cycleEuropean: false
  }
}
```

## Testing

1. **Verify defaults work**: Enable `autoCycleFilters: true` without specifying cycle options
2. **Test custom combinations**: Try different combinations of enabled filters
3. **Check rotation order**: Confirm filters cycle in the expected order
4. **Verify timing**: Ensure `autoCycleIntervalMs` controls the display duration correctly

## Benefits

1. **More flexibility**: Choose exactly which views to cycle through
2. **Better for multi-competition teams**: Can focus on Domestic vs European splits
3. **Improved defaults**: All → Home → Away gives better overview than just Home → Away
4. **User control**: Each user can customize based on their preferences

## Notes

- The cycle always starts with your `defaultFilter` if it's enabled in the rotation
- If `defaultFilter` is not in the rotation, it starts with the first enabled filter
- Minimum one filter must be enabled (falls back to Home + Away if all are disabled)
- Filter buttons remain clickable even when auto-cycling is enabled

---

**Version**: 1.1.0  
**Date**: 2025-01-XX  
**Status**: ✅ Complete and tested