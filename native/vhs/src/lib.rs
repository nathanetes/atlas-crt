//! Atlas CRT's tape stage: a thin WebAssembly wrapper around the ntsc-rs core library.
//!
//! The page writes settings as ntsc-rs preset JSON into `settings_buffer`, then a frame of RGBA
//! bytes into `frame_buffer`, and calls `process`, which leaves the result in the same buffer.
//! A wasm instance runs one thread, so the single `Stage` below is only ever touched by one caller.
use core::cell::UnsafeCell;

use ntscrs::{
    Context, NtscEffect,
    settings::SettingsList,
    yiq_fielding::{BlitInfo, DeinterlaceMode, Rect, Rgbx, YiqView},
};

struct Stage {
    ctx: Context,
    list: SettingsList<NtscEffect>,
    effect: NtscEffect,
    json: Vec<u8>,
    pixels: Vec<u8>,
    yiq: Vec<f32>,
    size: (usize, usize),
}

struct Holder(UnsafeCell<Option<Stage>>);
// wasm32 here has no threads
unsafe impl Sync for Holder {}
static STAGE: Holder = Holder(UnsafeCell::new(None));

fn stage() -> &'static mut Stage {
    let slot = unsafe { &mut *STAGE.0.get() };
    slot.get_or_insert_with(|| Stage {
        ctx: Context::new(),
        list: SettingsList::new(),
        effect: NtscEffect::default(),
        json: Vec::new(),
        pixels: Vec::new(),
        yiq: Vec::new(),
        size: (0, 0),
    })
}

/// Room for `len` bytes of preset JSON.
#[unsafe(no_mangle)]
pub extern "C" fn settings_buffer(len: usize) -> *mut u8 {
    let s = stage();
    s.json.resize(len, 0);
    s.json.as_mut_ptr()
}

/// Reads the preset in the settings buffer. Returns 1 if it was understood, 0 if not, and the
/// previous settings stay in place.
#[unsafe(no_mangle)]
pub extern "C" fn apply_settings() -> i32 {
    let s = stage();
    let parsed = core::str::from_utf8(&s.json).ok().and_then(|text| s.list.from_json_generic(text).ok());
    match parsed {
        Some(effect) => {
            s.effect = effect;
            1
        }
        None => 0,
    }
}

/// Room for a `width` by `height` frame of RGBA bytes.
#[unsafe(no_mangle)]
pub extern "C" fn frame_buffer(width: usize, height: usize) -> *mut u8 {
    let s = stage();
    s.size = (width, height);
    s.pixels.resize(width * height * 4, 0);
    s.pixels.as_mut_ptr()
}

/// Runs frame number `frame` through the tape. `flip` is 1 when the first row in the buffer is the
/// bottom of the picture, as WebGL reads it back.
#[unsafe(no_mangle)]
pub extern "C" fn process(frame: usize, flip: i32) {
    let s = stage();
    let (width, height) = s.size;
    let field = s.effect.use_field.to_yiq_field(frame);
    s.yiq.resize(YiqView::buf_length_for(s.size, field), 0.0);
    let mut view = YiqView::from_parts(&mut s.yiq, s.size, field);
    let blit = BlitInfo::new(Rect::from_width_height(width, height), (0, 0), width * 4, height, flip != 0);
    view.set_from_strided_buffer::<Rgbx, u8, _>(&s.ctx, &s.pixels, blit, ());
    s.effect.apply_effect_to_yiq(&s.ctx, &mut view, frame, [1.0, 1.0]);
    view.write_to_strided_buffer::<Rgbx, u8, _>(&s.ctx, &mut s.pixels, blit, DeinterlaceMode::Bob, ());
}
