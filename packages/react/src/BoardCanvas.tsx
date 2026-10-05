import { isTextEditable } from "@kritzlboard/core"
import { useBoardContext } from "./context.js"
import { ShapeView } from "./ShapeView.js"
import { BindingOverlay } from "./BindingOverlay.js"
import { SelectionOverlay } from "./SelectionOverlay.js"
import { PeerCursors } from "./PeerCursors.js"
import { TextEditor } from "./TextEditor.js"

export function BoardCanvas() {
  const {
    svgRef,
    shapes,
    peers,
    brushBox,
    eraseSet,
    bindingPreview,
    editingId,
    setEditingId,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onDoubleClick,
    editor: { store, camera, selectedShapes },
  } = useBoardContext()
  const editingShape = shapes.find((shape) => shape.id === editingId)
  const gridSize = 24 * camera.z
  const showGrid = camera.z > 0.3
  return (
    <>
      {showGrid && (
        <div
          aria-hidden
          className="kb-grid"
          style={{
            backgroundImage:
              "radial-gradient(circle, #d6d3d1 1px, transparent 1px)",
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${-camera.x * camera.z}px ${-camera.y * camera.z}px`,
          }}
        />
      )}

      <svg
        ref={svgRef}
        className="kb-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        <g
          transform={`scale(${camera.z}) translate(${-camera.x} ${-camera.y})`}
        >
          {shapes.map((shape) =>
            // a standalone text shape being edited is replaced by the HTML
            // editor; labeled shapes stay visible, only their label hides
            shape.id === editingId && shape.type === "text" ? null : (
              <ShapeView
                key={shape.id}
                shape={shape}
                fadeOut={eraseSet.has(shape.id)}
                hideLabel={shape.id === editingId}
              />
            )
          )}
          <SelectionOverlay
            peers={peers}
            shapes={shapes}
            selectedShapes={selectedShapes}
            camera={camera}
            brushBox={brushBox}
            hideHandles={editingId != null}
          />
          {bindingPreview &&
            (() => {
              const target = store.getShape(bindingPreview.targetId)
              return target ? (
                <BindingOverlay
                  shape={target}
                  anchor={bindingPreview.anchor}
                  snapPointId={bindingPreview.snapPointId}
                  zoom={camera.z}
                />
              ) : null
            })()}
        </g>
        <PeerCursors peers={peers} camera={camera} />
      </svg>

      {editingShape && isTextEditable(editingShape) && (
        <TextEditor
          key={editingShape.id}
          store={store}
          shape={editingShape}
          camera={camera}
          onDone={() => setEditingId(null)}
        />
      )}
    </>
  )
}
