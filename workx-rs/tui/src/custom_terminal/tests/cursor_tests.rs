use super::*;
use pretty_assertions::assert_eq;

#[test]
fn terminal_draw_repairs_owned_wide_hyperlink_after_skipped_glyphs() {
    let mut terminal =
        Terminal::with_options(CaptureBackend::new(/*width*/ 8, /*height*/ 1)).expect("terminal");
    let area = Rect::new(
        /*x*/ 0, /*y*/ 0, /*width*/ 8, /*height*/ 1,
    );
    terminal.set_viewport_area(area);
    let mut frames = Vec::new();
    for _ in 0..2 {
        terminal.backend_mut().output.clear();
        terminal
            .draw(|frame| {
                let buffer = frame.buffer_mut();
                buffer.set_string(0, 0, "中x界", Style::default().bg(Color::Blue));
                buffer[(0, 0)].diff_option = CellDiffOption::Skip;
                buffer[(2, 0)].diff_option = CellDiffOption::Skip;
                buffer[(3, 0)].set_symbol("\x1b]8;;https://example.com\x07界\x1b]8;;\x07");
                buffer[(3, 0)].diff_option =
                    CellDiffOption::ForcedWidth(NonZeroU16::new(/*n*/ 2).expect("wide glyph"));
                frame.set_cursor_position((5, 0));
            })
            .expect("draw");
        frames.push(terminal.backend().output().escape_debug().to_string());
    }
    assert_snapshot!("cursor_style_owned_wide_frames", frames.join("\n"));
}

#[test]
fn terminal_draw_repairs_single_column_without_scrolling() {
    let mut terminal =
        Terminal::with_options(CaptureBackend::new(/*width*/ 1, /*height*/ 1)).expect("terminal");
    let area = Rect::new(
        /*x*/ 0, /*y*/ 0, /*width*/ 1, /*height*/ 1,
    );
    terminal.set_viewport_area(area);
    let mut frames = Vec::new();
    let mut parser =
        vt100::Parser::new(/*rows*/ 1, /*cols*/ 1, /*scrollback_len*/ 1);
    for _ in 0..3 {
        terminal.backend_mut().output.clear();
        terminal
            .draw(|frame| {
                Paragraph::new("x")
                    .style(Style::default().bg(Color::Blue))
                    .render(area, frame.buffer_mut());
                frame.set_cursor_position((0, 0));
            })
            .expect("draw");
        parser.process(&terminal.backend().output);
        assert_eq!(parser.screen().contents(), "x");
        assert_eq!(parser.screen().cursor_position(), (0, 0));
        frames.push(terminal.backend().output().escape_debug().to_string());
    }
    parser.screen_mut().set_scrollback(/*rows*/ 1);
    assert_eq!(parser.screen().scrollback(), 0);
    assert_snapshot!("cursor_style_single_column_frames", frames.join("\n"));
}

#[test]
fn terminal_draw_omits_cursor_style_without_an_owned_glyph() {
    let mut terminal =
        Terminal::with_options(CaptureBackend::new(/*width*/ 2, /*height*/ 1)).expect("terminal");
    for width in [0, 2] {
        terminal.set_viewport_area(Rect::new(
            /*x*/ 0, /*y*/ 0, width, /*height*/ 1,
        ));
        for buffer in &mut terminal.buffers {
            for cell in &mut buffer.content {
                cell.diff_option = CellDiffOption::Skip;
            }
        }
        terminal.backend_mut().output.clear();
        terminal
            .draw(|frame| {
                for cell in &mut frame.buffer_mut().content {
                    cell.diff_option = CellDiffOption::Skip;
                }
                frame.set_cursor_style(SetCursorStyle::SteadyBar);
                frame.set_cursor_position((1, 0));
            })
            .expect("draw");
        assert_eq!(
            terminal.backend().output(),
            "\x1b[m\x1b[m\x1b[0m\x1b[1;2H\x1b[?25h"
        );
    }
    terminal.set_viewport_area(Rect::default());
    terminal.backend_mut().output.clear();
    terminal.draw(|_| {}).expect("hide cursor");
    assert_eq!(terminal.backend().output(), "\x1b[m\x1b[m\x1b[0m\x1b[?25l");
}
