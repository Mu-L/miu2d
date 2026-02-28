use std::collections::HashMap;
use std::fs;

fn check_msf(path: &str) {
    let data = match fs::read(path) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("Failed to read {}: {}", path, e);
            return;
        }
    };
    if data.len() < 28 || &data[0..4] != b"MSF2" {
        eprintln!("{}: not MSF2", path);
        return;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);
    let frame_count = u16::from_le_bytes([data[12], data[13]]) as usize;
    let pf = data[24];
    let pal_size = u16::from_le_bytes([data[25], data[26]]) as usize;

    // find blob start: skip header + palette + frame table + extension chunks
    let mut pos = 28 + pal_size * 4 + frame_count * 16;
    while pos + 4 <= data.len() {
        if &data[pos..pos + 4] == b"END\0" {
            pos += 8;
            break;
        }
        if pos + 8 > data.len() {
            break;
        }
        let sz = u32::from_le_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]])
            as usize;
        pos += 8 + sz;
    }

    let blob = &data[pos..];
    let raw: Vec<u8> = if flags & 1 != 0 {
        match zstd::decode_all(blob) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("{}: zstd decode failed: {}", path, e);
                return;
            }
        }
    } else {
        blob.to_vec()
    };

    let mut counts: HashMap<u8, usize> = HashMap::new();
    for i in (3..raw.len()).step_by(4) {
        *counts.entry(raw[i]).or_default() += 1;
    }

    let total: usize = counts.values().sum();
    if total == 0 {
        println!("{}: 0 pixels", path);
        return;
    }
    let semi: usize = counts
        .iter()
        .filter(|(&k, _)| k > 0 && k < 255)
        .map(|(_, v)| v)
        .sum();
    let opaque = counts.get(&255).copied().unwrap_or(0);
    let transp = counts.get(&0).copied().unwrap_or(0);

    let mut semi_vals: Vec<u8> = counts
        .keys()
        .filter(|&&k| k > 0 && k < 255)
        .copied()
        .collect();
    semi_vals.sort();

    println!(
        "{}: frames={} pf={} pixels={} transp={:.0}% opaque={:.0}% semi={:.0}% vals={:?}",
        path,
        frame_count,
        pf,
        total,
        100.0 * transp as f64 / total as f64,
        100.0 * opaque as f64 / total as f64,
        100.0 * semi as f64 / total as f64,
        &semi_vals[..semi_vals.len().min(15)]
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: check-alpha <file.msf> [file2.msf ...]");
        return;
    }
    for path in &args[1..] {
        check_msf(path);
    }
}
